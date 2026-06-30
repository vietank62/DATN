export const Footer = () => {
    return (
        <footer className="flex-col bg-[#2C2C2C] text-white">
            <div className="py-10">
                <div className="mx-10 px-4">
                    <div className="grid grid-cols-3 gap-10">
                        <div className="flex-col">
                            <h2 className="w-30 font-semibold mb-6 pb-1.25 border-b-2 border-white">CONTACT US</h2>
                            <div className="flex gap-2 items-center py-2">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-4">
                                <path fillRule="evenodd" d="m7.539 14.841.003.003.002.002a.755.755 0 0 0 .912 0l.002-.002.003-.003.012-.009a5.57 5.57 0 0 0 .19-.153 15.588 15.588 0 0 0 2.046-2.082c1.101-1.362 2.291-3.342 2.291-5.597A5 5 0 0 0 3 7c0 2.255 1.19 4.235 2.292 5.597a15.591 15.591 0 0 0 2.046 2.082 8.916 8.916 0 0 0 .189.153l.012.01ZM8 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" />
                                </svg>
                                <h4 className="text-sm">Office I : Di An, Binh Duong</h4>
                            </div>
                            <div className="flex gap-2 items-center py-2">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-4">
                                <path fillRule="evenodd" d="m7.539 14.841.003.003.002.002a.755.755 0 0 0 .912 0l.002-.002.003-.003.012-.009a5.57 5.57 0 0 0 .19-.153 15.588 15.588 0 0 0 2.046-2.082c1.101-1.362 2.291-3.342 2.291-5.597A5 5 0 0 0 3 7c0 2.255 1.19 4.235 2.292 5.597a15.591 15.591 0 0 0 2.046 2.082 8.916 8.916 0 0 0 .189.153l.012.01ZM8 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" />
                                </svg>
                                <h4 className="text-sm">Office II : District 10, Ho Chi Minh City</h4>
                            </div>
                            <div className="flex gap-2 items-center py-2">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-4">
                                <path fillRule="evenodd" d="m3.855 7.286 1.067-.534a1 1 0 0 0 .542-1.046l-.44-2.858A1 1 0 0 0 4.036 2H3a1 1 0 0 0-1 1v2c0 .709.082 1.4.238 2.062a9.012 9.012 0 0 0 6.7 6.7A9.024 9.024 0 0 0 11 14h2a1 1 0 0 0 1-1v-1.036a1 1 0 0 0-.848-.988l-2.858-.44a1 1 0 0 0-1.046.542l-.534 1.067a7.52 7.52 0 0 1-4.86-4.859Z" clipRule="evenodd" />
                                </svg>
                                <h4 className="text-sm">Phone : 0975 354 204</h4>
                            </div>
                        </div>
                        <div className="flex-col">
                            <h2 className="w-30 font-semibold mb-6 pb-1.25 border-b-2 border-white">ABOUT US</h2>
                            <h4 className="text-sm hover:text-blue-500 py-2"><a href="">Giới thiệu</a></h4>
                            <h4 className="text-sm hover:text-blue-500 py-2"><a href="">Hướng dẫn mua hàng</a></h4>
                            <h4 className="text-sm hover:text-blue-500 py-2"><a href="">Chính sách đổi trả</a></h4>
                            <h4 className="text-sm hover:text-blue-500 py-2"><a href="">Chính sách thanh toán</a></h4>
                        </div>
                        <div className="flex-col">
                            <h2 className="w-30 font-semibold mb-6 pb-1.25 border-b-2 border-white">FOLLOW US</h2>
                            <div className="flex gap-2">
                                <a href="https://www.facebook.com/pv.ank62" title="Visit our Facebook page"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="fill-white size-8 cursor-pointer"><path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64h98.2V334.2H109.4V256h52.8V222.3c0-87.1 39.4-127.5 125-127.5c16.2 0 44.2 3.2 55.7 6.4V172c-6-.6-16.5-1-29.6-1c-42 0-58.2 15.9-58.2 57.2V256h83.6l-14.4 78.2H255V480H384c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64z"/></svg></a>
                                <a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.instagram.com%2Fpv.ank62%3Ffbclid%3DIwZXh0bgNhZW0CMTAAYnJpZBExYzVoSTRucTgweDU4UXNhdAEe5LgkZVa3ZKXldCK0axK-3-8eZVneHFfzwBmHDuxOYDb9z5gUE37af8Oa7Kg_aem_P9_6g-OWKvTDnX5Gz3snbA&h=AT0xckBU_yWC5yKu1FLR7esQ1h3tTUYNH0Rtp7rJZA9ze8LcHOQZUFHd5hC1SB4RLWfZfN3iGM0uSAMaFjKqkSYOeCDVL7jo_kv8U101QpYffLUwOXuqML_xMRoRc7w1_C1xgI3SSwPy1QrXu0mJ" title="Visit our Instagram page"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="fill-white size-8 cursor-pointer"><path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/></svg></a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="text-center text-sm py-2">
                <h1>Pham Viet Anh & Nguyen Hoang Minh, All Rights Reserved.</h1>
            </div>
        </footer>
    );
}