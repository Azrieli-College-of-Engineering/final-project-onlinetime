import React, { useEffect, useState } from 'react';

function Sidebar({ onSelectUser }) {
    const [activeTab, setActiveTab] = useState("chats"); // מצב: 'chats' או 'contacts'
    const [conversations, setConversations] = useState([]);
    const [users, setUsers] = useState([]);
    
    const myId = localStorage.getItem("userId");
    const myUsername = localStorage.getItem("username");

    // 1. טעינת השיחות שלי (מה-Endpoint החדש)
// 1. טעינת השיחות שלי (מה-Endpoint החדש)
    useEffect(() => {
        const fetchConversations = async () => {
            try {
                // התיקון הוא כאן: פסיק ואז פתיחת סוגריים מסולסלים
                const response = await fetch(`http://localhost:3001/conversations/${myId}`, {
                    credentials: "include" 
                });
                
                const data = await response.json();
                
                // נוסיף הגנה קטנה למקרה שהשרת עדיין מחזיר שגיאה (כדי שלא נתרסק)
                if (response.ok) {
                    setConversations(data);
                } else {
                    console.error("Error from server:", data);
                    setConversations([]); // נשמור מערך ריק כדי למנוע קריסה
                }

            } catch (err) {
                console.error("Failed to fetch conversations", err);
            }
        };

        if (myId) fetchConversations();
    }, [myId, activeTab]);

// 2. טעינת כל המשתמשים
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                // גם כאן: מעבירים כאובייקט
                const response = await fetch("http://localhost:3001/users", {
                    credentials: "include" 
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    const otherUsers = data.filter(user => user.username !== myUsername);
                    setUsers(otherUsers);
                } else {
                    console.error("Error from server:", data);
                    setUsers([]);
                }

            } catch (err) {
                console.error("Failed to fetch users", err);
            }
        };

        if (activeTab === "contacts") fetchUsers(); 
    }, [activeTab, myUsername]);

    // פונקציית עזר: מתוך שיחה, תמצא מי החבר (מי לא "אני")
    const getFriendFromConversation = (conversation) => {
        return conversation.participants.find(p => p._id !== myId);
    };

    return (
        <div style={{ 
            width: "35%", 
            minWidth: "280px",
            backgroundColor: "white", 
            borderLeft: "1px solid #ddd", 
            display: "flex",
            flexDirection: "column",
            height: "100%"
        }}>
            {/* כותרת וטאבים */}
            <div style={{ backgroundColor: "#f0f2f5", padding: "10px", borderBottom: "1px solid #ddd" }}>
                <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "10px" }}>
                    <button 
                        onClick={() => setActiveTab("chats")}
                        style={{
                            flex: 1,
                            padding: "8px",
                            border: "none",
                            background: activeTab === "chats" ? "#fff" : "transparent",
                            fontWeight: activeTab === "chats" ? "bold" : "normal",
                            borderBottom: activeTab === "chats" ? "3px solid #00a884" : "none",
                            cursor: "pointer"
                        }}
                    >
                        שיחות
                    </button>
                    <button 
                        onClick={() => setActiveTab("contacts")}
                        style={{
                            flex: 1,
                            padding: "8px",
                            border: "none",
                            background: activeTab === "contacts" ? "#fff" : "transparent",
                            fontWeight: activeTab === "contacts" ? "bold" : "normal",
                            borderBottom: activeTab === "contacts" ? "3px solid #00a884" : "none",
                            cursor: "pointer"
                        }}
                    >
                        אנשי קשר
                    </button>
                </div>
            </div>

            {/* רשימת התוכן (משתנה לפי הטאב שנבחר) */}
            <div style={{ overflowY: "auto", flex: 1 }}>
                
                {/* --- תצוגת השיחות --- */}
                {activeTab === "chats" && (
                    conversations.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "gray" }}>
                            אין שיחות פעילות.<br/>עבור ל"אנשי קשר" כדי להתחיל!
                        </div>
                    ) : (
                        conversations.map((conv) => {
                            const friend = getFriendFromConversation(conv);
                            // הגנה: אם אין חבר (קרה באג בשרת), אל תציג
                            if (!friend) return null; 

                            return (
                                <div 
                                    key={conv._id} 
                                    onClick={() => onSelectUser(friend)} // שולחים את פרטי החבר, ה-ChatPage כבר יידע לטפל בזה
                                    style={{
                                        padding: "15px",
                                        borderBottom: "1px solid #f0f2f5",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        direction: "rtl",
                                        justifyContent: "flex-start" 
                                    }}
                                >
                                    <div style={{ width: "45px", height: "45px", backgroundColor: "#dfe5e7", borderRadius: "50%", marginLeft: "15px" }}></div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ fontWeight: "bold" }}>{friend.username}</span>
                                            <span style={{ fontSize: "11px", color: "gray" }}>
                                                {/* הצגת השעה של ההודעה האחרונה אם קיימת */}
                                                {conv.updatedAt && new Date(conv.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                        {/* הצגת ההודעה האחרונה */}
                                        <div style={{ fontSize: "13px", color: "gray", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }}>
                                            {conv.lastMessage || "התחלתם צ'אט חדש"}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )
                )}

                {/* --- תצוגת אנשי הקשר (כמו קודם) --- */}
                {activeTab === "contacts" && (
                    users.map((user) => (
                        <div 
                            key={user._id} 
                            onClick={() => {
                                onSelectUser(user);
                                setActiveTab("chats"); // מעבר אוטומטי לשיחות אחרי בחירה
                            }}
                            style={{
                                padding: "15px",
                                borderBottom: "1px solid #f0f2f5",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                direction: "rtl",
                                justifyContent: "flex-start" 
                            }}
                        >
                            <div style={{ width: "40px", height: "40px", backgroundColor: "#dfe5e7", borderRadius: "50%", marginLeft: "15px" }}></div>
                            <div>
                                <div style={{ fontWeight: "bold" }}>{user.username}</div>
                                <div style={{ fontSize: "12px", color: "gray" }}>{user.phone}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default Sidebar;