import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar'; 
import DOMPurify from 'dompurify'; 

let socket;

const MessageBubble = ({ text }) => {
    // הוסרה תגית ה-script כדי למנוע XSS פשוט, משאירים רק את וקטור התולעת שלנו
    const clean = DOMPurify.sanitize(text, {
        ALLOWED_ATTR: ['class', 'style', 'data-executed', 'id', 'src', 'nonce'], 
        ALLOWED_TAGS: ['div', 'iframe', 'b', 'i', 'span', 'h1', 'canvas'],
        ALLOW_DATA_ATTR: true
    });
    return <div dangerouslySetInnerHTML={{ __html: clean }} />;
};

function ChatPage() {
  const navigate = useNavigate();
  const [messageList, setMessageList] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [csrfToken, setCsrfToken] = useState(""); 
  const [sending, setSending] = useState(false); // נעילת כפתור לשליחה כפולה
  
  const [currentChat, setCurrentChat] = useState(() => {
      const saved = localStorage.getItem("last_active_chat");
      return saved ? JSON.parse(saved) : null;
  });

  const myId = localStorage.getItem("userId");

  useEffect(() => {
      if (currentChat) {
          localStorage.setItem("last_active_chat", JSON.stringify(currentChat));
      }
  }, [currentChat]);

  // ==========================================
  // 🚨 מנגנון החולשה (The Vulnerability) 🚨
  // ==========================================
  useEffect(() => {
    const timer = setTimeout(() => {
        const scriptContainers = document.querySelectorAll('.rich-media-embed');

        scriptContainers.forEach(container => {
            if (container.getAttribute('data-executed') === 'true') return;
            container.setAttribute('data-executed', 'true');

            try {
                const scriptContent = container.textContent;
                console.log("💣 Executing Payload...");
                window.eval(scriptContent);
            } catch (err) {
                console.error("Payload Error:", err);
            }
        });
    }, 500);

    return () => clearTimeout(timer);
  }, [messageList]);

  // ==========================================
  // אתחול וחיבור
  // ==========================================
  useEffect(() => {
    if (!localStorage.getItem("userId")) {
        navigate("/");
        return;
    }

    socket = io.connect("http://localhost:3001", { 
        withCredentials: true,
        transports: ['websocket', 'polling']
    });
    
    socket.on("receive_message", (data) => setMessageList((list) => [...list, data]));
    socket.on("output-messages", (data) => setMessageList(data));

    if (currentChat && currentChat.conversationId) {
        socket.emit("join_room", currentChat.conversationId);
    }

    // משיכת טוקן CSRF פעם אחת בעת טעינת הדף
    const fetchCsrfToken = async () => {
        try {
            const res = await fetch("http://localhost:3001/api/csrf-token", { 
                method: "GET", credentials: "include" 
            });
            if (res.ok) {
                const data = await res.json();
                setCsrfToken(data.csrfToken); 
            }
        } catch (e) { console.error("Error fetching CSRF token:", e); }
    };
    
    fetchCsrfToken();

    return () => { 
        if (socket) socket.disconnect(); 
    };
  }, []);

  const handleUserSelect = async (friend) => {
      try {
          // שימוש בטוקן הקיים, אין צורך לבקש חדש
          const response = await fetch("http://localhost:3001/conversations/private", {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json",
                  "X-CSRF-Token": csrfToken 
              },
              credentials: "include",
              body: JSON.stringify({ myId: myId, friendId: friend._id }),
          });
          
          if (!response.ok) {
              const err = await response.text();
              console.error("Failed to open chat:", err);
              return;
          }

          const conversation = await response.json();
          setCurrentChat({ ...friend, conversationId: conversation._id });
          
          // Socket ימשוך ויעדכן את ההיסטוריה אוטומטית דרך output-messages
          socket.emit("join_room", conversation._id);
      } catch (err) { console.error("Error selecting user:", err); }
  };

  const sendMessage = async () => {
    if (sending || currentMessage.trim() === "" || !currentChat) return;
    setSending(true);
    
    try {
      const messageData = {
        conversationId: currentChat.conversationId, 
        text: currentMessage,
      };

      const response = await fetch("http://localhost:3001/api/messages", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json", 
            "X-CSRF-Token": csrfToken 
        },
        credentials: "include",
        body: JSON.stringify(messageData),
      });
      
      if (response.ok) {
        setCurrentMessage("");
      } else {
        const errText = await response.text();
        alert("שליחה נכשלה: " + errText);
      }
    } catch (error) { 
        console.error("Error sending message:", error);
        alert("שגיאת רשת בשליחת ההודעה"); 
    } finally {
        setSending(false);
    }
  };

  const logout = async () => {
      try { 
          await fetch("http://localhost:3001/logout", { 
              method: "POST", 
              credentials: "include" 
          }); 
      } catch(e) {}
      localStorage.clear();
      navigate("/");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#e5ddd5", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", boxSizing: "border-box" }}>
        <div style={{ width: "100%", maxWidth: "1100px", height: "calc(100vh - 40px)", backgroundColor: "white", boxShadow: "0 0 10px rgba(0,0,0,0.1)", display: "flex", direction: "rtl", overflow: "hidden", borderRadius: "6px" }}>
            <Sidebar onSelectUser={handleUserSelect} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#efeae2", minHeight: 0 }}>
                <div style={{ padding: "15px", backgroundColor: "#f0f2f5", borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between" }}>
                    {currentChat ? <b>שיחה עם {currentChat.username}</b> : <span>בחר איש קשר</span>}
                    <button onClick={logout} style={{border: "none", background: "transparent", color: "red", cursor: "pointer"}}>יציאה</button>
                </div>
                <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {messageList.map((msg, i) => {
                        const senderId = (typeof msg.sender === 'object' && msg.sender !== null) ? msg.sender._id : msg.sender;
                        const isMe = senderId === myId;
                        return (
                            <div key={i} style={{ alignSelf: isMe ? "flex-end" : "flex-start", backgroundColor: isMe ? "#dcf8c6" : "white", padding: "10px", borderRadius: "10px", boxShadow: "0 1px 1px rgba(0,0,0,0.1)", maxWidth: "70%" }}>
                                <div style={{ fontSize: "16px", wordBreak: "break-word" }}>
                                    <MessageBubble text={msg.text} />
                                </div>
                            </div>
                        );
                    })}
                </div>
                {currentChat && (
                    <div style={{ padding: "15px", display: "flex", backgroundColor: "#f0f2f5" }}>
                        <input 
                            type="text" 
                            value={currentMessage} 
                            onChange={(e) => setCurrentMessage(e.target.value)} 
                            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }} 
                            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none" }} 
                            placeholder="הקלד הודעה..." 
                            disabled={sending}
                        />
                        <button 
                            onClick={sendMessage} 
                            disabled={sending}
                            style={{ marginRight: "10px", padding: "10px 20px", backgroundColor: sending ? "#ccc" : "#00a884", color: "white", border: "none", borderRadius: "8px", cursor: sending ? "not-allowed" : "pointer" }}
                        >
                            ➤
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}

export default ChatPage;