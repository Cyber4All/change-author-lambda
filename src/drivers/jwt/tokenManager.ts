import * as jwt from 'jsonwebtoken';
import jwt_decode from 'jwt-decode';
import 'dotenv/config';

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
          Action: 'execute-api:Invoke, s3:*',
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

// https://yos.io/2017/09/03/serverless-authentication-with-jwt/
function authorizeUser (user: UserToken, methodArn) {
  if (!user.accessGroups.includes('curator' || 'editor' || 'admin')) {
    return false;
  }
  return true;
}


// @ts-ignore
export const handler = (event: any, context: any, callback: any) => {
  const token = event.authorizationToken.substring(7);
  const secretKey = process.env.KEY;
  try {
    // Verify JWT
    const decoded = jwt.verify(token, secretKey) as UserToken;
    const user = decoded;

    // Checks if the user's scopes allow her to call the current function
    const isAllowed = authorizeUser(user, event.methodArn);
    const userId = user.username;
    const authorizerContext = { user: JSON.stringify(user) };
    // Return an IAM policy document for the current endpoint
    const policyDocument = buildIAMPolicy(userId, event.methodArn, authorizerContext);

    callback(null, policyDocument);

  } catch (e) {
    callback('Unauthorized'); // Return a 401 Unauthorized response
  }
};
