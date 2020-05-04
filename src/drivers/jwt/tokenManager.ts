import * as jwt from 'jsonwebtoken';

export interface Requester {
    username: string;
    name: string;
    email: string;
    organization: string;
    emailVerified: boolean;
    accessGroups: string[];
}

export function generateUserToken(user: Requester) {
    const payload = {
      username: user.username,
      name: user.name,
      email: user.email,
      organization: user.organization,
      emailVerified: user.emailVerified,
      accessGroups: user.accessGroups,
    };
    const options = {
      issuer: process.env.ISSUER,
      expiresIn: 86400,
      audience: 'https://clark.center',
    };
    return jwt.sign(payload, process.env.KEY, options);
}