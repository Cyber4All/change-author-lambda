import * as jwt from 'jsonwebtoken';
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

// https://yos.io/2017/09/03/serverless-authentication-with-jwt/

// function authorizeUser(accessGroups: string[], methodArn) {
//   accessGroups.forEach(group => {
//     if (group.includes('curator') || group === 'editor' || group === 'admin')
//       return true;
//   });
//   return false;
// }

function buildIAMPolicy(userId, resource, context) {
  const policy = {
    principalId: userId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: resource,
        },
      ],
    },
    context,
  };

  return policy;
}


function authorizeUser (user: UserToken, methodArn) {
  if (!user.accessGroups.includes('curator' || 'editor' || 'admin')) {
    return false;
  }
  return true;
}

// @ts-ignore
export const handler = (event: any, context: any, callback: any) => {
  const token = event.authorizationToken.substring(7);
  const secretKey = 'THIS_IS_A_KEY';
  console.log(token);

  try {
    // Verify JWT
    const decoded = jwt.verify(token, secretKey) as UserToken;
    const user = decoded;
    console.log(user);

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
