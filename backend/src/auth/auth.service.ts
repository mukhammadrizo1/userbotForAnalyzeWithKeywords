import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const validUsername = process.env.DASHBOARD_USERNAME || 'admin';
    const validPassword = process.env.DASHBOARD_PASSWORD || 'admin123';

    if (username === validUsername && pass === validPassword) {
      return { username };
    }
    return null;
  }

  async login(user: any): Promise<any> {
    const validUser = await this.validateUser(user.username, user.password);
    if (!validUser) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { username: validUser.username };
    return {
      access_token: this.jwtService.sign(payload),
      user: { username: validUser.username },
    };
  }

  async verifyToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
