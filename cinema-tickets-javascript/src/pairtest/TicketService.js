import TicketTypeRequest from './lib/TicketTypeRequest.js';
import InvalidPurchaseException from './lib/InvalidPurchaseException.js';
import TicketPaymentService from "../thirdparty/paymentgateway/TicketPaymentService.js";
import SeatReservationService from "../thirdparty/seatbooking/SeatReservationService.js";

export default class TicketService {
  /**
   * Should only have private methods other than the one below.
   */

  #ticketPrices = {
    ADULT: 20,
    CHILD: 10,
    INFANT: 0,
  };

  #maxNoOfTicketsPerPurchase = 20;

  constructor(paymentService, reservationService) {
    this.paymentService = paymentService;
    this.reservationService = reservationService;
  }

  #calculateTotalPrice(type, noOfTickets = 0) {
    return noOfTickets * this.#ticketPrices[type];
  }

  #calculatetotalNumberOfTickets(ticketTypeRequests) {
    return ticketTypeRequests.reduce((sum, request) => {
      const newTicketRequest = new TicketTypeRequest(
        request.type,
        request.noOfTickets
      );

      return sum + newTicketRequest.getNoOfTickets();
    }, 0);
  }

  #getTicketCount(ticketTypeRequests) {
    return ticketTypeRequests.reduce((sum, request) => {
      const newTicketRequest = new TicketTypeRequest(
        request.type,
        request.noOfTickets
      );
      sum[newTicketRequest.getTicketType()] = sum[
        newTicketRequest.getTicketType()
      ]
        ? sum[newTicketRequest.getTicketType()] +
          newTicketRequest.getNoOfTickets()
        : newTicketRequest.getNoOfTickets();
      return sum;
    }, {});
  }

  purchaseTickets(accountId, ...ticketTypeRequests) {
    // throws InvalidPurchaseException
    if (ticketTypeRequests.length === 0) {
      throw new InvalidPurchaseException(
        "At least one ticket request is required"
      );
    }

    const totalNumOfTickets =
      this.#calculatetotalNumberOfTickets(ticketTypeRequests);

    if (
      totalNumOfTickets < 1 ||
      totalNumOfTickets > this.#maxNoOfTicketsPerPurchase
    ) {
      throw new InvalidPurchaseException(
        `Number of tickets purchased at a time must be between 1 and ${
          this.#maxNoOfTicketsPerPurchase
        }`
      );
    }

    const ticketCount = this.#getTicketCount(ticketTypeRequests);

    if (!ticketCount["ADULT"] || ticketCount["ADULT"] <= 0) {
      throw new InvalidPurchaseException(
        "At least one adult ticket is required"
      );
    }

    if (ticketCount["INFANT"] && ticketCount["INFANT"] > ticketCount["ADULT"]) {
      throw new InvalidPurchaseException(
        "There must be at least one adult per infant"
      );
    }

     const infantTicket = this.#calculateTotalPrice(
       "INFANT",
       ticketCount["INFANT"]
     );
     const childTicket = this.#calculateTotalPrice(
       "CHILD",
       ticketCount["CHILD"]
     );
     const adultTicket = this.#calculateTotalPrice(
       "ADULT",
       ticketCount["ADULT"]
     );

     const totalPrice = infantTicket + childTicket + adultTicket;
     const numOfSeats = totalNumOfTickets - (ticketCount["INFANT"] || 0);

     this.paymentService.makePayment(accountId, totalPrice);
     this.reservationService.reserveSeat(accountId, numOfSeats);

      return { totalPrice, numOfSeats };
  }
}


// Example:
const ticketService = new TicketService(
  new TicketPaymentService(),
  new SeatReservationService()
);

const purchaseRequests = [
  {
    type: "ADULT",
    noOfTickets: 5,
  },
  {
    type: "CHILD",
    noOfTickets: 2,
  },
  {
    type: "INFANT",
    noOfTickets: 2,
  },
];


console.log(ticketService.purchaseTickets(15, ...purchaseRequests));

