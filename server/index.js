const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');

const JWT_SECRET = "MoshikoTheKing123_SecretKey_Don't_Tell_Anyone"; 
const MONGODB_URI = "mongodb+srv://haerj13579_db_user:Tnt5KurdhxARqYBd@cluster0.1ufwobw.mongodb.net/whatsapp_db?appName=Cluster0";
const PORT = 3001;

const app = express();
const server = http.createServer(app);

// אחסון זמני של טוקנים (UserId -> CSRF Token)
const csrfTokens = new Map();

// הגדרות CORS
const corsOptions = {
    origin: "http://localhost:5173", 
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-CSP-Nonce"]
};

const io = new Server(server, { 
    cors: corsOptions,
    transports: ['websocket', 'polling']
});

// ==========================================
//        MIDDLEWARE - בסיסי
// ==========================================
app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions)); // preflight
app.use(express.json({ limit: '30kb' }));
app.use(cookieParser());

// ==========================================
//        חיבור למסד נתונים
// ==========================================
mongoose.connect(MONGODB_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas!"))
    .catch((err) => console.log("❌ MongoDB connection error:", err));

// ==========================================
//        Models
// ==========================================
const userSchema = new mongoose.Schema({ 
    username: String, 
    phone: { type: String, unique: true },
    createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({ 
    conversationId: mongoose.Types.ObjectId, 
    sender: mongoose.Types.ObjectId, 
    text: String
}, { timestamps: true });

const conversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Types.ObjectId, ref: 'User' }],
    type: { type: String, enum: ['private', 'group'], default: 'private' }, 
    lastMessage: String,
    lastMessageTime: { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);
const Conversation = mongoose.model("Conversation", conversationSchema);

// ==========================================
//        🛡️ הגנות אבטחה
// ==========================================

// Helmet
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Nonce
app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');
    next();
});

// CSP
app.use((req, res, next) => {
    const cspDirectives = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${res.locals.nonce}'`,
        "style-src 'self' 'unsafe-inline'",
        "frame-src 'self' https://www.youtube.com https://player.vimeo.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
    ].join('; ');
    
    res.setHeader('Content-Security-Policy', cspDirectives);
    next();
});

// X-Frame-Options
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

// X-Content-Type-Options
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

// ==========================================
//        🔓 נתיבים ציבוריים (ללא CSRF)
// ==========================================

// בדיקת שרת
app.get("/test", (req, res) => {
    res.json({ message: "Server is working!", nonce: res.locals.nonce });
});

// התחברות
app.post("/login", async (req, res) => {
    const { username, phone } = req.body;
    
    if (!username || !phone) {
        return res.status(400).json({ error: "Missing fields" });
    }
    
    try {
        let user = await User.findOne({ phone });
        
        if (!user) {
            user = new User({ username, phone });
            await user.save();
        }
        
        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
        
        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        
        res.json({ 
            message: "login successful", 
            username: user.username, 
            userId: user._id
        });
        
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// ==========================================
//        🏃 Rate Limiter
// ==========================================
const userLastMessage = new Map();

const rateLimiter = (req, res, next) => {
    if (req.path === '/api/messages' && req.method === 'POST') {
        const userId = req.cookies?.userId || req.ip; 
        const now = Date.now();
        const lastTime = userLastMessage.get(userId) || 0;
        const timeDiff = now - lastTime;

        if (timeDiff < 1000) {
            return res.status(429).json({ error: "Too fast" });
        }
        userLastMessage.set(userId, now);
    }
    next();
};

app.use(rateLimiter);

// ==========================================
//        🧹 ניקוי זיכרון (Memory Leak Prevention)
// ==========================================
setInterval(() => {
    const now = Date.now();
    for (const [userId, tokenData] of csrfTokens.entries()) {
        if (tokenData.expires < now) {
            csrfTokens.delete(userId);
        }
    }
}, 60 * 60 * 1000); // רץ כל שעה

// ==========================================
//        🛡️ CSRF Protection (מעודכן)
// ==========================================

function generateCSRFToken(userId) {
    const token = {
        value: uuidv4(),
        expires: Date.now() + 3600000 // שעה
    };
    csrfTokens.set(userId, token);
    return token.value;
}

// נתיב לקבלת CSRF טוקן - מעודכן לתמוך בטאבים מרובים
app.get("/api/csrf-token", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "No session" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;
        
        // בדיקה אם כבר יש טוקן בתוקף למשתמש זה
        const existingToken = csrfTokens.get(userId);
        let csrfToken;

        if (existingToken && existingToken.expires > Date.now()) {
            csrfToken = existingToken.value;
        } else {
            csrfToken = generateCSRFToken(userId);
        }
        
        res.cookie('XSRF-TOKEN', csrfToken, {
            httpOnly: false,
            secure: false,
            sameSite: 'lax',
            maxAge: 3600000
        });

        res.json({ csrfToken });
    } catch(e) {
        res.status(403).json({ error: "Invalid token" });
    }
});

// CSRF Middleware - מעודכן
const csrfProtection = (req, res, next) => {
    const publicPaths = ['/login', '/test', '/users', '/conversations', '/messages'];
    const isPublicPath = publicPaths.some(path => req.path.startsWith(path));
    
    if (req.method === "GET") {
        if (isPublicPath || !req.path.includes('/api/')) {
            return next();
        }
    }

    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "No session" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;
        
        const clientToken = req.headers['x-csrf-token'] || 
                            req.body._csrf || 
                            req.cookies['XSRF-TOKEN'];
        
        const serverTokenData = csrfTokens.get(userId);
        
        if (!serverTokenData || serverTokenData.expires < Date.now()) {
            csrfTokens.delete(userId);
            return res.status(403).json({ error: "CSRF Token expired" });
        }

        if (!clientToken || clientToken !== serverTokenData.value) {
            return res.status(403).json({ error: "CSRF Token Mismatch" });
        }
        
        next(); 
    } catch (e) {
        return res.status(403).json({ error: "Invalid Request" });
    }
};

app.use(csrfProtection);

// ==========================================
//        📱 נתיבי תאימות לאחור
// ==========================================

// GET conversations
app.get("/conversations/:userId", async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        const decoded = jwt.verify(token, JWT_SECRET);
        const myObjectId = new mongoose.Types.ObjectId(decoded.userId);

        const conversations = await Conversation.find({ 
            participants: { $in: [myObjectId] } 
        })
        .populate('participants', 'username phone')
        .sort({ lastMessageTime: -1 });

        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// POST private conversation
app.post("/conversations/private", async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        const decoded = jwt.verify(token, JWT_SECRET);
        const { myId, friendId } = req.body;

        const sortedParticipants = [myId, friendId].sort().map(id => new mongoose.Types.ObjectId(id));

        const conversation = await Conversation.findOneAndUpdate(
            { 
                participants: { $eq: sortedParticipants }, 
                type: 'private' 
            },
            { 
                $setOnInsert: { 
                    participants: sortedParticipants,
                    type: 'private',
                    lastMessage: "",
                    lastMessageTime: new Date()
                } 
            },
            { 
                new: true,    
                upsert: true, 
                setDefaultsOnInsert: true
            }
        ).populate('participants', 'username phone');

        res.json(conversation);
    } catch (e) {
        res.status(500).json({ error: "Could not create conversation" });
    }
});

// GET users
app.get("/users", async (req, res) => {
    try {
        const users = await User.find({}, 'username phone _id'); 
        res.json(users);
    } catch (err) { 
        res.status(500).json({ error: "Failed to fetch users" }); 
    }
});

// GET messages
app.get("/messages/:conversationId", async (req, res) => {
    try {
        const messages = await Message.find({ 
            conversationId: req.params.conversationId 
        }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// ==========================================
//        🔌 API Routes
// ==========================================

// GET my conversations
app.get("/api/my-conversations", async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        const decoded = jwt.verify(token, JWT_SECRET);
        const myObjectId = new mongoose.Types.ObjectId(decoded.userId);

        const conversations = await Conversation.find({ 
            participants: { $in: [myObjectId] } 
        })
        .populate('participants', 'username phone')
        .sort({ lastMessageTime: -1 });

        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// POST message
app.post("/api/messages", async (req, res) => {
    try {
        const token = req.cookies.token;
        if(!token) return res.status(401).json({ error: "No Token" });
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const realSenderId = decoded.userId;
        const { conversationId, text } = req.body;

        // ==========================================
        //        🛡️ סניטציה צד-שרת מחמירה
        // ==========================================
        const cleanText = sanitizeHtml(text, {
            allowedTags: [ 'b', 'i', 'em', 'strong', 'a', 'div', 'span', 'iframe' ],
            allowedAttributes: {
                'a': [ 'href' ],
                'iframe': [ 'src', 'class' ], 
                'div': [ 'class' ],
                'span': [ 'class' ]
            },
            allowedIframeHostnames: ['www.youtube.com', 'player.vimeo.com', 'youtu.be']
        });

        // Validate rich media
        let validatedText = cleanText;
        if (cleanText && cleanText.includes('<iframe')) {
            const allowedDomains = ['youtube.com', 'youtu.be', 'vimeo.com', 'player.vimeo.com'];
            const srcMatch = cleanText.match(/src=["'](https?:\/\/[^"']+)["']/i);
            if (srcMatch) {
                try {
                    const url = new URL(srcMatch[1]);
                    const isAllowed = allowedDomains.some(domain => url.hostname.includes(domain));
                    if (!isAllowed) {
                        validatedText = '[Rich Media blocked - unauthorized domain]';
                    }
                } catch(e) {
                    validatedText = '[Invalid URL]';
                }
            }
        }

        const newMessage = new Message({ 
            conversationId, 
            sender: realSenderId, 
            text: validatedText
        });
        await newMessage.save();

        await Conversation.findByIdAndUpdate(conversationId, { 
            lastMessage: validatedText, 
            lastMessageTime: new Date() 
        });

        const messageToSend = { 
            _id: newMessage._id, 
            conversationId, 
            sender: realSenderId, 
            text: validatedText, 
            createdAt: newMessage.createdAt
        };
        
        io.to(String(conversationId)).emit("receive_message", messageToSend);
        res.status(201).json(messageToSend);
        
    } catch (err) { 
        res.status(500).json({ error: "Error" }); 
    }
});

// ==========================================
//        🔌 Socket.io
// ==========================================
io.on("connection", (socket) => {
    socket.on("join_room", async (id) => {
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });

        const room = String(id);
        socket.join(room);
        
        try {
            const msgs = await Message.find({ conversationId: id }).sort({ createdAt: 1 });
            socket.emit("output-messages", msgs);
        } catch (err) {
            console.log("Error loading messages", err);
        }
    });

    socket.on("disconnect", () => {});
});

// ==========================================
//        🧹 ניקוי (לבדיקה)
// ==========================================
app.get("/api/nuke-all", async (req, res) => {
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    csrfTokens.clear();
    userLastMessage.clear();
    res.send("<h1>☢️ ATOMIC WIPE: ALL DATA CLEARED ☢️</h1>");
});

// ==========================================
//        🚀 הפעלת השרת
// ==========================================
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));