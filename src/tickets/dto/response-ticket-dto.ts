export class ResponseTicketDto {
  id: string;
  subject: string;
  description: string;
  status: string;
  user_requester_id: string;
  user_agent_id: string | null;
  createdAt: Date;
  updatedAt: Date;
}