export interface ActivateAccountPayload {
  uidb64: string;
  token: string;
  new_password: string;
}

export interface ActivateAccountResponse {
  detail: string;
  email: string;
  username: string;
}
