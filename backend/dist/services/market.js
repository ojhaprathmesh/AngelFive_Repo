"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketService = exports.MarketService = void 0;
const otplib_1 = require("otplib");
const undici_1 = require("undici");
class MarketService {
    constructor() {
        Object.defineProperty(this, "clientcode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "password", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "totpSecret", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "apiKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "localIP", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "publicIP", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "macAddress", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "jwtToken", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "tokenExpiry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.clientcode = process.env.SMARTAPI_CLIENT_CODE || "";
        this.password = process.env.SMARTAPI_PASSWORD || "";
        this.totpSecret = process.env.SMARTAPI_TOTP_SECRET || "";
        this.apiKey = process.env.SMARTAPI_API_KEY || "";
        this.localIP = process.env.SMARTAPI_LOCAL_IP || "127.0.0.1";
        this.publicIP = process.env.SMARTAPI_PUBLIC_IP || "127.0.0.1";
        this.macAddress = process.env.SMARTAPI_MAC_ADDRESS || "00:00:00:00:00:00";
    }
    async getJwt() {
        if (this.jwtToken && Date.now() < this.tokenExpiry - 300000)
            return this.jwtToken;
        const totp = otplib_1.authenticator.generate(this.totpSecret);
        const res = await (0, undici_1.fetch)("https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-PrivateKey": this.apiKey,
                Accept: "application/json",
                "X-SourceID": "WEB",
                "X-ClientLocalIP": this.localIP,
                "X-ClientPublicIP": this.publicIP,
                "X-MACAddress": this.macAddress,
                "X-UserType": "USER",
            },
            body: JSON.stringify({ clientcode: this.clientcode, password: this.password, totp }),
        });
        if (!res.ok)
            throw new Error(`Login failed ${res.status}`);
        const data = (await res.json());
        if (!data.status || !data.data?.jwtToken)
            throw new Error(data.message || "Login error");
        this.jwtToken = data.data.jwtToken;
        this.tokenExpiry = Date.now() + 3600000;
        return this.jwtToken;
    }
    async fetchQuotes(exchangeTokens, mode = "FULL") {
        const jwt = await this.getJwt();
        const res = await (0, undici_1.fetch)("https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${jwt}`,
                "X-PrivateKey": this.apiKey,
                "X-SourceID": "WEB",
                "X-ClientLocalIP": this.localIP,
                "X-ClientPublicIP": this.publicIP,
                "X-MACAddress": this.macAddress,
                "X-UserType": "USER",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ mode, exchangeTokens }),
        });
        if (!res.ok)
            throw new Error(`Quote failed ${res.status}`);
        const data = (await res.json());
        const fetched = data.data?.fetched || [];
        return fetched.map((q) => ({
            symbol: q.tradingSymbol,
            price: q.ltp,
            change: q.netChange,
            changePercent: q.percentChange,
            lastUpdated: q.exchFeedTime,
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.tradeVolume,
            token: q.symbolToken,
        }));
    }
    async getCandleData(exchange, symbolToken, interval, fromDate, toDate) {
        const jwt = await this.getJwt();
        const res = await (0, undici_1.fetch)("https://apiconnect.angelone.in/rest/secure/angelbroking/historical/v1/getCandleData", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${jwt}`,
                "X-PrivateKey": this.apiKey,
                "X-SourceID": "WEB",
                "X-ClientLocalIP": this.localIP,
                "X-ClientPublicIP": this.publicIP,
                "X-MACAddress": this.macAddress,
                "X-UserType": "USER",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ exchange, symboltoken: symbolToken, interval, fromdate: fromDate, todate: toDate }),
        });
        if (!res.ok)
            throw new Error(`Candles failed ${res.status}`);
        const data = (await res.json());
        return data.data || [];
    }
}
exports.MarketService = MarketService;
exports.marketService = new MarketService();
//# sourceMappingURL=market.js.map