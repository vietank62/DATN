import hotPotIcon from '../../assets/hot-pot.png';
import roastIcon from '../../assets/roast.png';
import buffetIcon from '../../assets/buffet.png';
import seafoodIcon from '../../assets/seafood.png';
import sushiIcon from '../../assets/sushi.png';
import koreanFoodIcon from '../../assets/korea.png';
import vietnameseFoodIcon from '../../assets/pho.png';
import euroFoodIcon from "../../assets/pizza.png"
import chinaFoodIcon from "../../assets/buns.png"
import vegetablesFoodIcon from "../../assets/vegetables.png"
import { useNavigate } from 'react-router-dom'; 

const categoriesData = [
    { id: 1, name: 'Lẩu', icon: hotPotIcon, searchParam: 'lau' },
    { id: 2, name: 'Nướng', icon: roastIcon, searchParam: 'nuong' },
    { id: 3, name: 'Buffet', icon: buffetIcon, searchParam: 'buffet' },
    { id: 4, name: 'Hải sản', icon: seafoodIcon, searchParam: 'hai-san' },
    { id: 5, name: 'Món Nhật', icon: sushiIcon, searchParam: 'mon-nhat' },
    { id: 6, name: 'Món Hàn', icon: koreanFoodIcon, searchParam: 'mon-han' },
    { id: 7, name: 'Món Việt', icon: vietnameseFoodIcon, searchParam: 'mon-viet' },
    { id: 8, name: 'Món Âu', icon: euroFoodIcon, searchParam: 'mon-au' },
    { id: 9, name: 'Món Trung', icon: chinaFoodIcon, searchParam: 'mon-trung' },
    { id: 10, name: 'Món chay', icon: vegetablesFoodIcon, searchParam: 'mon-chay' },
];

export const CategoryList = () => {
    const navigate = useNavigate(); 

    const handleCategoryClick = (categoryName: string) => {
        const category = categoriesData.find((cat) => cat.name === categoryName);
        if (category) {
            navigate(`/search?category=${category.searchParam}`);
        }
    };
    return (
        <div className="w-full bg-white py-6 border-b border-gray-100 flex justify-center">
            <div className="max-w-7xl w-full flex items-center justify-between px-10">
                <div className="flex items-center gap-8 justify-between no-scrollbar w-full">
                    {categoriesData.map((category) => (
                        <div
                            key={category.id}
                            onClick={() => handleCategoryClick(category.name)}
                            className="flex flex-col items-center justify-center cursor-pointer group min-w-20"
                        >
                            <div className="w-20 h-20 bg-white flex items-center justify-center rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.08)] group-hover:shadow-[0_4px_25px_rgba(0,0,0,0.15)] border border-white hover:border-red-500 transition-shadow duration-300 mb-3">
                                <img
                                    width="44"
                                    height="44"
                                    src={category.icon}
                                    alt={category.name}
                                    className="object-contain"
                                />
                            </div>
                            <span className="text-sm font-medium text-gray-800 group-hover:text-black transition-colors whitespace-nowrap">
                                {category.name}
                            </span>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
};
