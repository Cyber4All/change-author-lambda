"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var jwt = __importStar(require("jsonwebtoken"));
require("dotenv/config");
function buildIAMPolicy(userId, resource, context) {
    var policy = {
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
        context: context,
    };
    return policy;
}
function generateServiceToken() {
    var payload = {
        SERVICE_KEY: process.env.SERVICE_KEY,
    };
    var options = {
        issuer: process.env.ISSUER,
        expiresIn: 86400,
        audience: 'https://clark.center',
    };
    return jwt.sign(payload, process.env.KEY, options);
}
exports.generateServiceToken = generateServiceToken;
function authorizeUser(user, methodArn) {
    if (!user.accessGroups.includes('curator' || 'editor' || 'admin')) {
        return false;
    }
    return true;
}
exports.handler = function (event, context, callback) {
    var token = event.authorizationToken.substring(7);
    var secretKey = process.env.KEY;
    try {
        var decoded = jwt.verify(token, secretKey);
        var user = decoded;
        var isAllowed = authorizeUser(user, event.methodArn);
        var userId = user.username;
        var authorizerContext = { user: JSON.stringify(user) };
        var policyDocument = buildIAMPolicy(userId, event.methodArn, authorizerContext);
        callback(null, policyDocument);
    }
    catch (e) {
        callback('Unauthorized');
    }
};
//# sourceMappingURL=tokenManager.js.map