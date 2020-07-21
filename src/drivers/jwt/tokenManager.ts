import * as jwt from 'jsonwebtoken';
import 'dotenv/config';
import { CustomAuthorizerEvent, AuthResponse } from 'aws-lambda';

/**
 * The identity of a user in the CLARK system that allows us to authorize requests.
 * @interface
 */
interface UserToken {
  username: string;
  name: string;
  email: string;
  organization: string;
  emailVerified: boolean;
  accessGroups: string[];
}

function buildIAMPolicy(userId, resource, context) {
  const policy = {
    principalId: userId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: [resource,
          '*'],
        },
      ],
    },
    context,
  };
  return policy;
}

/**
 * The identity of a user in the CLARK system that allows us to authorize requests.
 * @interface
 */
export function generateServiceToken() {
  const payload = {
    SERVICE_KEY: process.env.SERVICE_KEY,
  };
  const options = {
    issuer: process.env.ISSUER,
    expiresIn: 86400,
    audience: 'https://clark.center',
  };
  return jwt.sign(payload, process.env.KEY, options);
}

/**
 * The identity of a user in the CLARK system that grants access based on user's access group.
 * @user
 */
// https://yos.io/2017/09/03/serverless-authentication-with-jwt/
function authorizeUser (user: UserToken) {
  if (user.accessGroups.includes('curator') ||
      user.accessGroups.includes ('editor') ||
      user.accessGroups.includes('admin')) {
    return true;
  }
  return false;
}

export enum APIGatewayErrorMessage {
  Unauthorized = 'Unauthorized',
  AccessDenied = 'Access Denied',
}

// @ts-ignore
export const handler = async (event: CustomAuthorizerEvent, context: any, callback: any): Promise<AuthResponse> => {
  try {
    const secretKey = process.env.KEY;
    if (!event.authorizationToken) {
      // In case no token is provided
      callback(new Error(APIGatewayErrorMessage.Unauthorized));
    }
    if (event.authorizationToken) {
      const [key, val] = event.authorizationToken.split(' ');
      if (key && key.toLowerCase() === 'bearer' && val) {
        const user = jwt.verify(val, secretKey) as UserToken;
        const isAllowed = authorizeUser(user);
        console.log('yeet', isAllowed);
        const authorizerContext = { user: JSON.stringify(user) };
        const userId = user.username;
        if (isAllowed === true) {
          // Return an IAM policy document for the current endpoint
          const policyDocument = buildIAMPolicy(userId, event.methodArn, authorizerContext);
          callback(null, policyDocument);
        } else {
          callback(new Error(APIGatewayErrorMessage.AccessDenied));
        }
      }
    }
  } catch (e) {
    callback(APIGatewayErrorMessage.Unauthorized);
  }
};
