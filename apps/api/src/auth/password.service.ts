import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  hash(password: string) {
    return argon2.hash(password);
  }

  verify(hash: string, password: string) {
    return argon2.verify(hash, password);
  }
}
