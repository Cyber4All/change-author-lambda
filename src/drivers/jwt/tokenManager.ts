import * as jwt from 'jsonwebtoken';

export interface Requester {
    username: string;
    name: string;
    email: string;
    organization: string;
    emailVerified: boolean;
    accessGroups: string[];
}

// https://yos.io/2017/09/03/serverless-authentication-with-jwt/
function authorizeUser(accessGroups: string[], methodArn) {
  accessGroups.forEach(group => {
    if (group.includes('curator') || group === 'editor' || group === 'admin')
      return true;
  });
  return false;
};

function buildIAMPolicy(userId, effect, resource, context) {
  const policy = {
    principalId: userId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  };

  return policy;
};

//@ts-ignore
export const handler = (event, context, callback) => {
  const token = event.authorizationToken;

  try {
    // Verify JWT
    const decoded = jwt.verify(token, process.env.KEY);
    const user = decoded.user;

    // Checks if the user's scopes allow her to call the current function
    const isAllowed = authorizeUser(user.accessGroups, event.methodArn);

    const effect = isAllowed ? 'Allow' : 'Deny';
    const userId = user.username;
    const authorizerContext = { user: JSON.stringify(user) };
    // Return an IAM policy document for the current endpoint
    const policyDocument = buildIAMPolicy(userId, effect, event.methodArn, authorizerContext);

    callback(null, policyDocument);
  } catch (e) {
    callback('Unauthorized'); // Return a 401 Unauthorized response
  }
};