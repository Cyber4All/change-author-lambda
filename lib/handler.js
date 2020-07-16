"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var mongodb_1 = require("./drivers/database/mongodb");
var request_promise_1 = __importDefault(require("request-promise"));
var tokenManager_1 = require("./drivers/jwt/tokenManager");
var Client = require('@elastic/elasticsearch').Client;
var AWS = require('aws-sdk');
var async = require('async');
require('dotenv').config();
var client, s3;
var bucketName = process.env.BUCKET_NAME;
exports.changeObjectAuthorHandler = function (event, context, callback) { return __awaiter(_this, void 0, void 0, function () {
    var db, _a, fromUserID, toUserID, objectID, fromObjects, oldAuthor, newAuthor, oldAuthorAccessID, newAuthorAccessID, response;
    var _this = this;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4, mongodb_1.MongoDB.getInstance()];
            case 1:
                db = _b.sent();
                client = setupElasticsearch();
                s3 = setupAWS();
                _a = JSON.parse(event.body), fromUserID = _a.fromUserID, toUserID = _a.toUserID, objectID = _a.objectID;
                return [4, db.getAuthorLearningObjects(objectID)];
            case 2:
                fromObjects = _b.sent();
                return [4, db.getUserAccount(fromUserID)];
            case 3:
                oldAuthor = _b.sent();
                return [4, db.getUserAccount(toUserID)];
            case 4:
                newAuthor = _b.sent();
                return [4, db.getFileAccessID(oldAuthor.username)];
            case 5:
                oldAuthorAccessID = _b.sent();
                return [4, db.getFileAccessID(newAuthor.username)];
            case 6:
                newAuthorAccessID = _b.sent();
                return [4, db.updateLearningObjectAuthor(objectID, toUserID)];
            case 7:
                _b.sent();
                moveLearningObjectChildren(fromObjects, toUserID, oldAuthorAccessID, newAuthorAccessID);
                updateSearchIndex(fromObjects, newAuthor);
                fromObjects.map(function (learningObject) { return __awaiter(_this, void 0, void 0, function () {
                    var cuid;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                cuid = learningObject.cuid;
                                return [4, copyFiles(cuid, oldAuthorAccessID, newAuthorAccessID)];
                            case 1:
                                _a.sent();
                                return [2];
                        }
                    });
                }); });
                updateLearningObjectReadMe(fromObjects);
                response = {
                    statusCode: 200,
                    message: 'success',
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    },
                };
                callback(null, response);
                return [2];
        }
    });
}); };
function setupElasticsearch() {
    return new Client({ node: process.env.ELASTIC_SEARCH_DOMAIN });
}
function setupAWS() {
    var AWS_SDK_CONFIG = {
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
        region: process.env.AWS_REGION,
    };
    AWS.config.credentials = AWS_SDK_CONFIG.credentials;
    AWS.region = AWS_SDK_CONFIG.region;
    if (process.env.MODE === 'dev') {
        return new AWS.S3({ endpoint: "http://localhost:4566", s3ForcePathStyle: true });
    }
    else {
        return new AWS.S3({ endpoint: 'http://s3.us-east-1.amazonaws.com', params: { Bucket: bucketName }, region: 'us-east-1' });
    }
}
function copyFiles(fromCuid, oldAuthorAccessID, newAuthorAccessID) {
    return __awaiter(this, void 0, void 0, function () {
        var oldPrefix, newPrefix;
        return __generator(this, function (_a) {
            oldPrefix = oldAuthorAccessID.fileAccessId + "/" + fromCuid;
            newPrefix = newAuthorAccessID.fileAccessId + "/" + fromCuid;
            try {
                s3.listObjectsV2({ Prefix: oldPrefix }, function (err, data) {
                    if (err) {
                        console.log(err, err.stack);
                    }
                    else {
                        console.log(data);
                    }
                    if (data.Contents.length) {
                        async.each(data.Contents, function (file, cb) {
                            if (!file.Key.includes(fromCuid + ".zip") && !file.Key.includes(".pdf")) {
                                console.log(file.Key);
                                var params = {
                                    Bucket: bucketName,
                                    CopySource: bucketName + '/' + file.Key,
                                    Key: file.Key.replace(oldPrefix, newPrefix),
                                };
                                s3.copyObject(params, function (copyErr, copyData) {
                                    if (copyErr) {
                                        console.log(copyErr);
                                    }
                                    else {
                                        console.log(copyData);
                                    }
                                    cb();
                                });
                            }
                        });
                    }
                });
            }
            catch (err) {
                console.log(err);
            }
            return [2];
        });
    });
}
function updateSearchIndex(fromObjects, newAuthor) {
    return __awaiter(this, void 0, void 0, function () {
        var db_1, e_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4, mongodb_1.MongoDB.getInstance()];
                case 1:
                    db_1 = _a.sent();
                    fromObjects.map(function (learningObject) { return __awaiter(_this, void 0, void 0, function () {
                        var learningObjectID;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    learningObjectID = learningObject._id;
                                    return [4, deleteSearchIndexItem(learningObjectID)];
                                case 1:
                                    _a.sent();
                                    return [2];
                            }
                        });
                    }); });
                    fromObjects.map(function (learningObject) { return __awaiter(_this, void 0, void 0, function () {
                        var contributors, j, author, p;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    contributors = [];
                                    j = 0;
                                    _a.label = 1;
                                case 1:
                                    if (!(j < learningObject.contributors.length)) return [3, 4];
                                    return [4, db_1.getUserAccount(learningObject.contributors[j])];
                                case 2:
                                    author = _a.sent();
                                    contributors.push(author);
                                    _a.label = 3;
                                case 3:
                                    j++;
                                    return [3, 1];
                                case 4:
                                    if (learningObject.outcomes !== undefined) {
                                        for (p = 0; p < learningObject.outcomes.length; p++) {
                                            learningObject.outcomes[p] = __assign({}, learningObject.outcomes[p], { mappings: [] });
                                        }
                                    }
                                    else {
                                        learningObject.outcomes = [];
                                    }
                                    return [4, insertSearchIndexItem(__assign({}, learningObject, { author: newAuthor }))];
                                case 5:
                                    _a.sent();
                                    return [2];
                            }
                        });
                    }); });
                    return [3, 3];
                case 2:
                    e_1 = _a.sent();
                    console.log(e_1);
                    return [3, 3];
                case 3: return [2];
            }
        });
    });
}
function deleteSearchIndexItem(learningObjectID) {
    return __awaiter(this, void 0, void 0, function () {
        var e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4, client.deleteByQuery({
                            index: 'learning-objects',
                            body: {
                                query: {
                                    bool: {
                                        must: [
                                            {
                                                match: { id: learningObjectID },
                                            },
                                        ],
                                    },
                                },
                            },
                        })];
                case 1:
                    _a.sent();
                    return [3, 3];
                case 2:
                    e_2 = _a.sent();
                    console.log(e_2);
                    return [3, 3];
                case 3: return [2];
            }
        });
    });
}
function insertSearchIndexItem(learningObject) {
    return __awaiter(this, void 0, void 0, function () {
        var e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4, client.index({
                            index: 'learning-objects',
                            type: '_doc',
                            body: formatLearningObjectSearchDocument(learningObject),
                        })];
                case 1:
                    _a.sent();
                    return [3, 3];
                case 2:
                    e_3 = _a.sent();
                    console.log(e_3);
                    return [3, 3];
                case 3: return [2];
            }
        });
    });
}
function formatLearningObjectSearchDocument(learningObject) {
    var learningObjectSearchDocument = {
        author: {
            name: learningObject.author.name,
            username: learningObject.author.username,
            email: learningObject.author.email,
            organization: learningObject.author.organization,
        },
        collection: learningObject.collection,
        contributors: learningObject.contributors.map(function (c) { return ({
            name: c.name,
            username: c.username,
            email: c.email,
            organization: c.organization,
        }); }),
        date: learningObject.date,
        description: learningObject.description,
        cuid: learningObject.cuid,
        id: learningObject._id,
        length: learningObject.length,
        levels: learningObject.levels,
        name: learningObject.name,
        outcomes: learningObject.outcomes,
        version: learningObject.version,
        status: learningObject.status,
    };
    return learningObjectSearchDocument;
}
function updateLearningObjectReadMe(fromObjects) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            fromObjects.map(function (learningObject) { return __awaiter(_this, void 0, void 0, function () {
                var learningObjectID, options;
                return __generator(this, function (_a) {
                    learningObjectID = learningObject._id;
                    options = {
                        uri: process.env.LEARNING_OBJECT_API + "/learning-objects/" + learningObjectID + "/pdf",
                        headers: {
                            Authorization: "Bearer " + tokenManager_1.generateServiceToken(),
                        },
                        method: 'PATCH',
                    };
                    request_promise_1.default(options);
                    return [2];
                });
            }); });
            return [2];
        });
    });
}
function moveLearningObjectChildren(fromObjects, newAuthorID, oldAuthorAccessID, newAuthorAccessID) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4, mongodb_1.MongoDB.getInstance()];
                case 1:
                    db = _a.sent();
                    try {
                        fromObjects.map(function (learningObject) { return __awaiter(_this, void 0, void 0, function () {
                            var children, i, objects;
                            var _this = this;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!learningObject.children) return [3, 5];
                                        children = [];
                                        i = 0;
                                        _a.label = 1;
                                    case 1:
                                        if (!(i < learningObject.children.length)) return [3, 4];
                                        return [4, db.updateLearningObjectAuthor(learningObject.children[i], newAuthorID)];
                                    case 2:
                                        objects = _a.sent();
                                        children.push(objects.value);
                                        children.map(function (child) { return __awaiter(_this, void 0, void 0, function () {
                                            var cuid;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        cuid = child.cuid;
                                                        return [4, copyFiles(cuid, oldAuthorAccessID, newAuthorAccessID)];
                                                    case 1:
                                                        _a.sent();
                                                        return [2];
                                                }
                                            });
                                        }); });
                                        _a.label = 3;
                                    case 3:
                                        i++;
                                        return [3, 1];
                                    case 4: return [3, 6];
                                    case 5:
                                        learningObject.children = [];
                                        _a.label = 6;
                                    case 6: return [2];
                                }
                            });
                        }); });
                    }
                    catch (e) {
                        console.log(e);
                    }
                    return [2];
            }
        });
    });
}
//# sourceMappingURL=handler.js.map