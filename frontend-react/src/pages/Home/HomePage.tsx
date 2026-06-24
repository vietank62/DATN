import { FilterBar } from "./filterBar";
import { CategoryList } from "./categoryList";
import { Home } from "./restaurantList";
export default function HomePage() {
  return (
    <div className="w-full">
      {/* Filter and Category sections moved from Navbar to HomePage */}
      <FilterBar />
      <CategoryList />
      <Home />
    </div>
  );
}
