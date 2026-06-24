import { Auth } from "./auth";
import { SearchBar } from "./searchBar";

export const Navbar = () => {
    return (
        <header className="flex flex-col w-full shadow-sm sticky top-0 z-[1000]">
            <Auth />

            <main className="flex flex-col w-full bg-white">
                <SearchBar />
            </main>
        </header>
    );
};