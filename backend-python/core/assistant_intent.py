"""Bounded Vietnamese restaurant-query parser; no LLM or claims of availability."""
import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from core.restaurant_search import normalize_text

LOCATIONS = json.loads(Path(__file__).with_name("assistant_locations.json").read_text(encoding="utf-8"))
CITY_ALIASES = {"Hồ Chí Minh": ("ho chi minh", "tp hcm", "tphcm", "hcm", "sai gon", "saigon"),
                "Hà Nội": ("ha noi", "hanoi"), "Đà Nẵng": ("da nang", "danang")}
FOODS = ("hai san", "mon nhat", "mon han", "mon viet", "mon thai", "mon trung", "mon au",
         "mon chay", "lau", "nuong", "buffet", "sushi", "pizza", "steak", "pho", "bun bo",
         "dim sum", "dimsum", "tom hum", "ca hoi", "bbq", "chay")
OCCASIONS = {"gia dinh": "gia-dinh", "hen ho": "hen-ho", "sinh nhat": "sinh-nhat", "ban be": "ban-be"}
SERVICES = {"phuc vu tai ban": "phuc-vu-tai-ban", "tu phuc vu": "tu-phuc-vu", "bang chuyen": "bang-chuyen", "omakase": "omakase"}
NUMBER = r"\d+(?:[.,]\d+)*"
UNIT = r"(?:trieu|nghin|ngan|tr|k|dong|vnd|đ)"


def fold(value):
    value = unicodedata.normalize("NFD", value.lower()).replace("đ", "d")
    return "".join(c for c in value if unicodedata.category(c) != "Mn")


def contains(text, phrase):
    return re.search(r"\b" + re.escape(phrase) + r"\b", text) is not None


def money(number, unit):
    if re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", number):
        value = float(number.replace(".", "").replace(",", ""))
    else:
        value = float(number.replace(",", "."))
    multiplier = 1_000_000 if unit in ("tr", "trieu") else 1000 if unit in ("k", "nghin", "ngan") else 1
    return int(value * multiplier)


@dataclass
class SearchIntent:
    filters: dict = field(default_factory=dict)
    labels: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    question: str | None = None


def parse_restaurant_request(message: str, fallback_city: str | None = None) -> SearchIntent:
    result = SearchIntent()
    raw, text = fold(message), normalize_text(message)
    cities = [city for city, aliases in CITY_ALIASES.items() if any(contains(text, alias) for alias in aliases)]
    if len(cities) > 1:
        result.question = "Bạn muốn tìm nhà hàng ở thành phố nào trong các nơi vừa nêu?"
        return result
    city = cities[0] if cities else fallback_city
    # Match districts from the application's catalog, including Q1 / Q.1 / quận 1.
    district_hits = []
    for owner, districts in LOCATIONS.items():
        for district in districts:
            key = normalize_text(district)
            short = re.sub(r"^(quan|huyen|thi xa|thanh pho) ", "", key)
            hit = contains(text, key)
            if short.isdigit():
                hit = hit or bool(re.search(r"\bq\.?\s*0?" + short + r"\b", raw))
            else:
                hit = hit or contains(text, short)
            if hit:
                district_hits.append((owner, district))
    district_hits = list(dict.fromkeys(district_hits))
    if len(district_hits) > 1:
        result.question = "Bạn muốn ưu tiên một quận/huyện nào để mình lọc chính xác?"
        return result
    if not district_hits and re.search(r"\b(?:quan\s+|q\.?\s*)\d+\b", raw):
        result.question = "Quận bạn nêu chưa khớp danh sách khu vực hiện có. Bạn cho mình tên quận/thành phố đầy đủ nhé."
        return result
    if district_hits:
        owner, district = district_hits[0]
        if cities and owner != city:
            result.question = "Khu vực và thành phố bạn nêu chưa khớp. Bạn xác nhận lại địa điểm giúp mình nhé."
            return result
        city = owner
        result.filters["district"] = district
        result.labels.append(district)
    if city:
        result.filters["city"] = city
        result.labels.append(city)

    party = re.search(r"\b(\d{1,4})\s*(?:nguoi|khach|thanh vien)\b", text)
    if party:
        size = int(party[1])
        children = re.search(r"\b(\d{1,4})\s*(?:tre em|tre nho|be)\b", text)
        if children and re.search(r"\bnguoi lon\b", party[0] + text[party.end():party.end()+5]):
            size += int(children[1])
        if not 1 <= size <= 1000:
            result.question = "Bạn cho mình số người dự kiến từ 1 đến 1.000 nhé."
            return result
        result.filters["party_size"] = size
        result.labels.append(f"nhóm {size} người")
        result.notes.append("Sức chứa phù hợp không đồng nghĩa còn bàn; cần xác nhận khi đặt bàn.")

    # Preserve decimal punctuation until money and ratings have been parsed.
    span = re.search(rf"\b(?:tu\s+)?({NUMBER})\s*({UNIT})?\s*(?:den|toi|[-–])\s*({NUMBER})\s*({UNIT})\b", raw)
    amounts = list(re.finditer(rf"\b({NUMBER})\s*({UNIT})\b", raw))
    if any(len(match[1]) > 15 for match in amounts) or (span and len(span[1]) > 15):
        result.question = "Bạn kiểm tra lại ngân sách và ghi số tiền theo đồng hoặc k/người giúp mình nhé."
        return result
    if span:
        lower = money(span[1], span[2] or span[4]); upper = money(span[3], span[4])
        if lower > upper:
            result.question = "Khoảng ngân sách đang bị đảo: bạn muốn từ bao nhiêu đến bao nhiêu đồng mỗi người?"
            return result
        result.filters.update(min_price=lower, max_price=upper)
    elif len(amounts) == 1:
        amount = amounts[0]; value = money(amount[1], amount[2])
        prefix = raw[max(0, amount.start()-35):amount.start()]
        if re.search(r"khong\s+(?:duoi|it hon)\s*$", prefix):
            result.filters["min_price"] = value
        elif re.search(r"(?:tren|hon)\s*$", prefix) and not re.search(r"(?:khong|chua)\s+(?:qua|hon)\s*$", prefix):
            result.filters["min_price"] = value + 1
        elif re.search(r"(?:it nhat|toi thieu|tu)\s*$", prefix):
            result.filters["min_price"] = value
        else:
            result.filters["max_price"] = value - 1 if re.search(r"duoi\s*$", prefix) else value
    elif len(amounts) > 1:
        result.question = "Bạn nêu nhiều mức tiền. Ngân sách áp dụng là bao nhiêu đồng mỗi người?"
        return result
    elif contains(text, "ngan sach") or contains(text, "gia re") or re.search(r"\b(?:gia|duoi|tren)\s+\d+\b", re.sub(r"\b(?:danh gia\s*)?\d+(?:[.,]\d+)?\s*sao\b", "", raw)):
        result.question = "Bạn dự kiến chi tối đa bao nhiêu đồng mỗi người, ví dụ 200k/người?"
        return result
    if any(key in result.filters for key in ("min_price", "max_price")):
        total = bool(re.search(r"\b(?:tong(?: ngan sach| cong| chi phi)?|ca (?:nhom|ban)|cho ca (?:nhom|ban))\b", text))
        per_person = bool(re.search(r"\b(?:moi nguoi|mot nguoi|1 nguoi)\b", text) or re.search(r"/\s*nguoi\b", raw))
        if total and not per_person:
            if not party:
                result.question = "Ngân sách này cho cả nhóm; nhóm bạn có bao nhiêu người?"
                return result
            for key in ("min_price", "max_price"):
                if key in result.filters:
                    amount = result.filters[key]
                    result.filters[key] = (amount + size - 1)//size if key == "min_price" else amount//size
        lo, hi = result.filters.get("min_price"), result.filters.get("max_price")
        if hi is not None and hi < 1:
            result.question = "Bạn kiểm tra lại mức ngân sách giúp mình nhé."
            return result
        if lo is not None: result.labels.append(f"giá trung bình từ {lo:,}đ/người")
        if hi is not None:
            if not span and len(amounts) == 1 and not total and re.search(r"duoi\s*$", raw[max(0, amounts[0].start()-35):amounts[0].start()]):
                result.labels.append(f"giá trung bình dưới {hi+1:,}đ/người")
            else:
                result.labels.append(f"giá trung bình tối đa {hi:,}đ/người")
        result.notes.append("Ngân sách được đối chiếu với giá trung bình của nhà hàng, không phải báo giá cho bữa ăn.")

    rating = re.search(r"\b([0-9]+(?:[.,][0-9]+)?)\s*sao\b", raw)
    if rating:
        value = float(rating[1].replace(",", "."))
        if not 0 <= value <= 5:
            result.question = "Bạn muốn mức đánh giá tối thiểu từ 0 đến 5 sao?"
            return result
        if re.search(r"(?:duoi|toi da|khong qua)\s*$", raw[max(0,rating.start()-20):rating.start()]):
            result.question = "Mình đang lọc theo đánh giá tối thiểu. Bạn muốn từ bao nhiêu sao trở lên?"
            return result
        result.filters["rating"] = value
        result.labels.append(f"đánh giá từ {value:g} sao")

    quoted = re.search(r'["“]([^"”]+)["”]', message)
    food_hits = [food for food in FOODS if contains(text, food)]
    food_hits = [food for food in food_hits if not any(food != other and food in other for other in food_hits)]
    food_hits.sort(key=lambda food: text.index(food))
    if re.search(r"\b(?:khong|tranh|tru|di ung)\b", text):
        for food in food_hits:
            if re.search(r"\b(?:khong(?: muon| thich| an| dung)*|tranh|tru|di ung(?: voi)?)\s+(?:mon\s+)?" + re.escape(food) + r"\b", text):
                result.question = "Mình chưa lọc được món cần loại trừ hoặc yêu cầu dị ứng. Bạn muốn tìm món nào có thể dùng? Với dị ứng, hãy xác nhận trực tiếp với nhà hàng."
                return result
    if len(food_hits) > 1 and any(re.search(re.escape(a) + r"\s+(?:hoac|hay)\s+(?:mon\s+)?" + re.escape(b), text) for a in food_hits for b in food_hits if a != b):
        result.question = "Bạn muốn ưu tiên loại món nào trong các lựa chọn vừa nêu?"
        return result
    if quoted:
        result.filters["keyword"] = quoted[1].strip()
    elif food_hits:
        result.filters["keyword"] = " ".join(food_hits)
    else:
        named = re.search(r"\b(?:ten la|ten)\s+(.+?)(?=\s+(?:o|tai|gia|ngan sach|cho|duoi)\b|$)", text)
        if not named:
            named = re.search(r"\bnha hang\s+(?!(?:o|tai|gan|cho|co|phu hop|ngan sach|gia|nao|de|tot)\b)(.+?)(?=\s+(?:o|tai|gia|ngan sach|cho|duoi)\b|$)", text)
        if named: result.filters["keyword"] = named[1].strip()
        elif len(text.split()) <= 6 and not any(contains(text, term) for term in ("tim", "goi y", "nha hang", "xin chao", "cam on")) and not district_hits:
            result.filters["keyword"] = text
    if len(result.filters.get("keyword", "")) > 100:
        result.question = "Bạn cho mình tên nhà hàng hoặc món ăn ngắn hơn 100 ký tự nhé."
        return result
    if result.filters.get("keyword"):
        display = result.filters["keyword"]
        for plain, accented in sorted({"hai san":"hải sản", "lau":"lẩu", "nuong":"nướng", "mon nhat":"món Nhật", "mon han":"món Hàn", "mon viet":"món Việt", "mon chay":"món chay", "chay":"chay", "pho":"phở", "tom hum":"tôm hùm", "ca hoi":"cá hồi"}.items(), key=lambda item: -len(item[0])):
            display = re.sub(r"\b" + re.escape(plain) + r"\b", accented, display)
        result.labels.insert(0, display)
    for mapping, key in ((OCCASIONS, "suitable_for"), (SERVICES, "service_type")):
        hits = [phrase for phrase in mapping if contains(text, phrase)]
        if len(hits) == 1:
            phrase = hits[0]
            if not re.search(r"\bkhong(?: can| muon)?\s+" + re.escape(phrase), text):
                result.filters[key] = mapping[phrase]
                result.labels.append({"gia dinh":"gia đình", "hen ho":"hẹn hò", "sinh nhat":"sinh nhật", "ban be":"bạn bè", "phuc vu tai ban":"phục vụ tại bàn", "tu phuc vu":"tự phục vụ", "bang chuyen":"băng chuyền"}.get(phrase, phrase))
    if contains(text, "uu dai") or contains(text, "khuyen mai"):
        if not re.search(r"\bkhong(?: can| co)?\s+(?:uu dai|khuyen mai)\b", text):
            result.filters["has_exclusive"] = True
            result.labels.append("có ưu đãi")
    if contains(text, "gan toi") or contains(text, "gan day"):
        if not district_hits:
            result.question = "Bạn đang ở quận/huyện nào? Mình chưa có vị trí GPS để tìm theo khoảng cách."
            return result
    if any(contains(text, p) for p in ("toi nay", "ngay mai", "cuoi tuan", "con ban", "dat ban")) or re.search(r"\b\d{1,2}\s*(?:h|gio)\b", text):
        result.notes.append("Mình chưa kiểm tra bàn trống theo ngày/giờ; bạn chọn nhà hàng để gửi yêu cầu đặt bàn.")
    if any(contains(text, p) for p in ("phong rieng", "cho do xe", "bai do xe", "yen tinh", "view dep")):
        result.notes.append("Các yêu cầu về phòng riêng, chỗ đỗ xe hoặc không gian cần xem thêm ở trang chi tiết nhà hàng.")
    useful = set(result.filters) - {"city"}
    if not useful:
        result.question = "Bạn muốn ăn món gì hoặc tìm nhà hàng ở quận/huyện nào? Có thể cho mình thêm ngân sách và số người."
    return result
