var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
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
import { WebSocketServer } from 'ws';
import { jwtVerify } from 'jose';
export function setupWebSocketServer(httpServer) {
    var _this = this;
    var wss = new WebSocketServer({ noServer: true });
    wss.on('connection', function (ws) { return __awaiter(_this, void 0, void 0, function () {
        var isAuthenticated;
        var _this = this;
        return __generator(this, function (_a) {
            isAuthenticated = false;
            ws.on('message', function (message) { return __awaiter(_this, void 0, void 0, function () {
                var data, secret, e_1, response, result, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 8, , 9]);
                            data = JSON.parse(message.toString());
                            if (!!isAuthenticated) return [3 /*break*/, 4];
                            if (!data.sessionToken) {
                                ws.send(JSON.stringify({ type: 'error', error: { message: 'No session token provided' } }));
                                ws.close();
                                return [2 /*return*/];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
                            return [4 /*yield*/, jwtVerify(data.sessionToken, secret)];
                        case 2:
                            _a.sent();
                            isAuthenticated = true;
                            ws.send(JSON.stringify({ type: 'status', status: 'authenticated' }));
                            return [2 /*return*/];
                        case 3:
                            e_1 = _a.sent();
                            ws.send(JSON.stringify({ type: 'error', error: { message: 'Invalid session token' } }));
                            ws.close();
                            return [2 /*return*/];
                        case 4:
                            if (!(data.type === 'audio')) return [3 /*break*/, 7];
                            return [4 /*yield*/, fetch('https://api.openai.com/v1/audio/speech', {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': "Bearer ".concat(process.env.OPENAI_API_KEY),
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        model: data.model,
                                        input: data.audio,
                                        metadata: data.metadata
                                    })
                                })];
                        case 5:
                            response = _a.sent();
                            if (!response.ok) {
                                throw new Error("OpenAI API error: ".concat(response.statusText));
                            }
                            return [4 /*yield*/, response.json()];
                        case 6:
                            result = _a.sent();
                            ws.send(JSON.stringify({
                                type: 'text',
                                text: result.text
                            }));
                            _a.label = 7;
                        case 7: return [3 /*break*/, 9];
                        case 8:
                            error_1 = _a.sent();
                            console.error('WebSocket error:', error_1);
                            ws.send(JSON.stringify({
                                type: 'error',
                                error: { message: error_1 instanceof Error ? error_1.message : 'Unknown error' }
                            }));
                            return [3 /*break*/, 9];
                        case 9: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    }); });
    return wss;
}
