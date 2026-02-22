import { useState } from 'react';

interface BookingDetails {
  date: string;
  time: string;
  guests: number;
  contactInfo: string;
}

const useBooking = () => {
  const [bookingDetails, setBookingDetails] = useState<BookingDetails>({
    date: '',
    time: '',
    guests: 1,
    contactInfo: '',
  });

  const updateBookingDetails = (newDetails: Partial<BookingDetails>) => {
    setBookingDetails((prevDetails) => ({
      ...prevDetails,
      ...newDetails,
    }));
  };

  const resetBookingDetails = () => {
    setBookingDetails({
      date: '',
      time: '',
      guests: 1,
      contactInfo: '',
    });
  };

  return {
    bookingDetails,
    updateBookingDetails,
    resetBookingDetails,
  };
};

export default useBooking;