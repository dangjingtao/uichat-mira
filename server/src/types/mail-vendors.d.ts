declare module "nodemailer" {
  type SendMailResult = {
    accepted: unknown[];
    rejected: unknown[];
    response: string;
    messageId: string;
  };

  type Transporter = {
    verify(): Promise<void>;
    sendMail(input: {
      from: string;
      to: string;
      subject: string;
      text: string;
    }): Promise<SendMailResult>;
  };

  const nodemailer: {
    createTransport(options: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    }): Transporter;
  };

  export default nodemailer;
}

declare module "mailparser" {
  type AddressObject = {
    name?: string;
    address?: string;
  };

  export function simpleParser(
    source: Buffer,
  ): Promise<{
    from?: { value?: AddressObject[] };
    to?: { value?: AddressObject[] };
    text?: string;
    html?: string | boolean;
    messageId?: string;
    subject?: string;
    date?: Date;
    attachments?: unknown[];
  }>;
}
