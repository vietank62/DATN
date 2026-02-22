# Restaurant Booking Application

This is a React application for a restaurant booking system. It allows users to search for restaurants, filter by various criteria, and make reservations.

## Project Structure

```
frontend-react
├── src
│   ├── main.tsx                # Entry point of the application
│   ├── App.tsx                 # Main application component with routing
│   ├── assets
│   │   └── styles
│   │       └── global.css      # Global styles including Tailwind CSS
│   ├── components
│   │   ├── Navbar               # Navbar component with logo and links
│   │   ├── HeroSection          # Main banner and search form
│   │   ├── FilterBar            # Component for filtering restaurants
│   │   ├── RestaurantCard       # Displays restaurant details
│   │   ├── RestaurantList       # Grid of RestaurantCard components
│   │   ├── BookingModal         # Form for booking a table
│   │   └── Footer               # Footer with contact info and links
│   ├── hooks
│   │   └── useBooking.ts        # Custom hook for managing booking state
│   ├── pages
│   │   ├── HomePage.tsx        # Main landing page
│   │   └── RestaurantDetailPage.tsx # Detailed view of a restaurant
│   ├── services
│   │   └── api.ts              # API calls for restaurant data
│   ├── types
│   │   └── index.ts            # TypeScript types and interfaces
│   └── utils
│       └── helpers.ts          # Utility functions
├── public
│   └── index.html              # Main HTML template
├── package.json                # npm configuration file
├── tsconfig.json               # TypeScript configuration
├── tsconfig.app.json           # TypeScript configuration for the app
├── vite.config.ts              # Vite configuration
└── README.md                   # Project documentation
```

## Features

- **Search and Filter**: Users can search for restaurants and filter results by cuisine type, price, area, and rating.
- **Restaurant Details**: Each restaurant card displays essential information, including an image, name, address, price range, and rating.
- **Booking System**: Users can book tables through a modal that collects date, time, guest count, and contact information.
- **Responsive Design**: The application is designed to be responsive and user-friendly across devices.

## Getting Started

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd frontend-react
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Start the development server:
   ```
   npm run dev
   ```

5. Open your browser and go to `http://localhost:3000` to view the application.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License.