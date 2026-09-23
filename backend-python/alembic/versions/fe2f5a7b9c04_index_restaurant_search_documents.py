"""Index Vietnamese restaurant search including tags, description and available dishes.

Revision ID: fe2f5a7b9c04
Revises: fd1e4a6c8b93
"""
from alembic import op

revision = "fe2f5a7b9c04"
down_revision = "fd1e4a6c8b93"
branch_labels = None
depends_on = None


# Also exercised in an isolated PostgreSQL schema by the integration test.
UPGRADE_SQL = r"""
CREATE FUNCTION search_normalize_text(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path FROM CURRENT AS $$
    SELECT trim(regexp_replace(lower(public.immutable_unaccent(coalesce(value, ''))), '[^a-z0-9]+', ' ', 'g'))
$$;
CREATE FUNCTION search_normalize_tags(values_array text[]) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path FROM CURRENT AS $$
    SELECT coalesce(array_agg(DISTINCT replace(search_normalize_text(tag), ' ', '-'))
        FILTER (WHERE search_normalize_text(tag) <> ''), ARRAY[]::text[])
    FROM unnest(values_array) tag
$$;
ALTER TABLE restaurants ADD COLUMN search_document tsvector NOT NULL DEFAULT ''::tsvector;

CREATE FUNCTION search_build_document(restaurant_key integer, restaurant_name text, restaurant_address text,
    restaurant_district text, restaurant_city text, categories text[], occasions text[], services text[])
RETURNS tsvector LANGUAGE sql VOLATILE SET search_path FROM CURRENT AS $$
    SELECT
        setweight(to_tsvector('simple', search_normalize_text(restaurant_name)), 'A') ||
        setweight(to_tsvector('simple', search_normalize_text(concat_ws(' ',
            array_to_string(categories, ' '), array_to_string(occasions, ' '), array_to_string(services, ' ')))), 'B') ||
        setweight(to_tsvector('simple', search_normalize_text((
            SELECT string_agg(concat_ws(' ', name, category), ' ' ORDER BY id)
            FROM restaurant_menu_lists WHERE restaurant_id = restaurant_key AND is_available = true))), 'B') ||
        setweight(to_tsvector('simple', search_normalize_text((
            SELECT description FROM restaurant_details WHERE restaurant_id = restaurant_key))), 'C') ||
        setweight(to_tsvector('simple', search_normalize_text((
            SELECT string_agg(description, ' ' ORDER BY id)
            FROM restaurant_menu_lists WHERE restaurant_id = restaurant_key AND is_available = true))), 'D') ||
        setweight(to_tsvector('simple', search_normalize_text(concat_ws(' ',
            restaurant_address, restaurant_district, restaurant_city))), 'D')
$$;
CREATE FUNCTION search_restaurant_before_write() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
    NEW.search_document := search_build_document(NEW.id, NEW.name, NEW.address, NEW.district,
        NEW.city, NEW.category, NEW.suitable_for, NEW.service_types);
    RETURN NEW;
END
$$;
CREATE TRIGGER search_restaurant_document BEFORE INSERT OR UPDATE OF
    name, address, district, city, category, suitable_for, service_types
ON restaurants FOR EACH ROW EXECUTE FUNCTION search_restaurant_before_write();

CREATE FUNCTION search_related_after_write() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
    previous_id integer;
    next_id integer;
    restaurant_key integer;
BEGIN
    IF TG_OP <> 'INSERT' THEN previous_id := OLD.restaurant_id; END IF;
    IF TG_OP <> 'DELETE' THEN next_id := NEW.restaurant_id; END IF;
    -- Lock first, then aggregate in a new statement to see concurrent committed changes.
    FOR restaurant_key IN SELECT id FROM restaurants WHERE id IN (previous_id, next_id) ORDER BY id FOR UPDATE LOOP
        UPDATE restaurants r SET search_document = search_build_document(r.id, r.name, r.address,
            r.district, r.city, r.category, r.suitable_for, r.service_types) WHERE r.id = restaurant_key;
    END LOOP;
    RETURN NULL;
END
$$;
CREATE TRIGGER search_menu_document AFTER INSERT OR DELETE OR UPDATE OF
    restaurant_id, name, category, description, is_available
ON restaurant_menu_lists FOR EACH ROW EXECUTE FUNCTION search_related_after_write();
CREATE TRIGGER search_detail_document AFTER INSERT OR DELETE OR UPDATE OF restaurant_id, description
ON restaurant_details FOR EACH ROW EXECUTE FUNCTION search_related_after_write();

UPDATE restaurants r SET search_document = search_build_document(r.id, r.name, r.address,
    r.district, r.city, r.category, r.suitable_for, r.service_types);
CREATE INDEX ix_restaurants_search_document ON restaurants USING gin (search_document);
CREATE INDEX ix_restaurants_category_normalized ON restaurants USING gin (search_normalize_tags(category));
CREATE INDEX ix_restaurants_suitable_normalized ON restaurants USING gin (search_normalize_tags(suitable_for));
CREATE INDEX ix_restaurants_service_normalized ON restaurants USING gin (search_normalize_tags(service_types));
CREATE INDEX ix_restaurants_location_normalized ON restaurants
    (search_normalize_text(city), search_normalize_text(district)) WHERE is_active = true;
"""


def upgrade():
    op.execute(UPGRADE_SQL)


def downgrade():
    op.execute("""
    DROP TRIGGER search_detail_document ON restaurant_details;
    DROP TRIGGER search_menu_document ON restaurant_menu_lists;
    DROP TRIGGER search_restaurant_document ON restaurants;
    DROP FUNCTION search_related_after_write();
    DROP FUNCTION search_restaurant_before_write();
    DROP FUNCTION search_build_document(integer, text, text, text, text, text[], text[], text[]);
    DROP INDEX ix_restaurants_location_normalized;
    DROP INDEX ix_restaurants_service_normalized;
    DROP INDEX ix_restaurants_suitable_normalized;
    DROP INDEX ix_restaurants_category_normalized;
    ALTER TABLE restaurants DROP COLUMN search_document;
    DROP FUNCTION search_normalize_tags(text[]);
    DROP FUNCTION search_normalize_text(text);
    """)
