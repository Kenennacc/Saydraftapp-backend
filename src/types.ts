export type User = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  session: string;
  timezone: string;
  verifiedAt?: Date;
};
