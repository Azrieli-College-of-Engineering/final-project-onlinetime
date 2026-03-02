  import React, { useState } from 'react';

  import { useNavigate } from 'react-router-dom';



  function Login() {

    const [username, setUsername] = useState("");

    const [phoneNumber, setPhoneNumber] = useState("");

    const navigate = useNavigate(); 



    const joinChat = async () => {

      if (username !== "" && phoneNumber !== "") {

        try {

          console.log("📤 Sending login request...");

          const response = await fetch("http://localhost:3001/login", {

            method: "POST",

            headers: { "Content-Type": "application/json" },

            credentials: "include",

            body: JSON.stringify({ username, phone: phoneNumber }),

          });



          console.log("📥 Response status:", response.status);

          

          if (!response.ok) {

              const errorText = await response.text();

              console.log("❌ Error response:", errorText);

              alert("התחברות נכשלה: " + errorText);

              return;

          }



          const data = await response.json();

          console.log("✅ Login response:", data);

          

          if (data.userId) {

            // שמירה ב-localStorage

            localStorage.setItem("username", data.username);

            localStorage.setItem("userId", data.userId);

            localStorage.setItem("loginTime", new Date().toISOString());

            

            console.log("✅ Saved to localStorage:", {

              username: data.username,

              userId: data.userId

            });

            

            // ניתוב לדף הצ'אט

            console.log("➡️ Navigating to /chat...");

            navigate("/chat", { replace: true });

          } else {

            console.log("❌ No userId in response");

            alert("שגיאה: לא התקבל מזהה משתמש");

          }

        } catch (error) {

          console.error("❌ Login Error:", error);

          alert("שגיאה בהתחברות: " + error.message);

        }

      } else {

        alert("נא למלא את כל השדות");

      }

    };



    // נוסיף כפתור לבדיקה ישירה

    const testNavigation = () => {

      console.log("Testing navigation...");

      navigate("/chat");

    };



    return (

      <div style={{ 

        display: "flex", 

        justifyContent: "center", 

        alignItems: "center", 

        minHeight: "100vh", 

        backgroundColor: "#e5ddd5", 

        fontFamily: "Arial" 

      }}>

        <div style={{ 

          backgroundColor: "#ffffff", 

          padding: "40px", 

          borderRadius: "10px", 

          boxShadow: "0 4px 10px rgba(0,0,0,0.1)", 

          width: "300px", 

          textAlign: "center", 

          direction: "rtl" 

        }}>

            <h3 style={{ color: "#075e54", marginBottom: "20px" }}>הכנס פרטים כדי להתחבר:</h3>

            <input 

              type="text" 

              placeholder="השם שלך..." 

              value={username}

              onChange={(e) => setUsername(e.target.value)} 

              style={{ 

                width: "100%", 

                padding: "12px", 

                marginBottom: "15px", 

                border: "1px solid #ddd", 

                borderRadius: "5px", 

                boxSizing: "border-box" 

              }} 

            />

            <input 

              type="text" 

              placeholder="המספר טלפון שלך.." 

              value={phoneNumber}

              onChange={(e) => setPhoneNumber(e.target.value)} 

              style={{ 

                width: "100%", 

                padding: "12px", 

                marginBottom: "20px", 

                border: "1px solid #ddd", 

                borderRadius: "5px", 

                boxSizing: "border-box" 

              }} 

            />

            <button 

              onClick={joinChat} 

              style={{ 

                width: "100%", 

                padding: "12px", 

                fontSize: "16px", 

                cursor: "pointer", 

                backgroundColor: "#25D366", 

                color: "white", 

                border: "none", 

                borderRadius: "5px", 

                fontWeight: "bold",

                marginBottom: "10px"

              }}

            >

              כנס לצ'אט

            </button>

            

            {/* כפתור לבדיקה - אם תלחץ כאן ואתה כבר מחובר, תועבר */}

            <button 

              onClick={testNavigation}

              style={{ 

                width: "100%", 

                padding: "8px", 

                fontSize: "14px", 

                cursor: "pointer", 

                backgroundColor: "#075e54", 

                color: "white", 

                border: "none", 

                borderRadius: "5px"

              }}

            >

              🧪 בדיקת ניתוב (אם כבר מחובר)

            </button>

        </div>

      </div>

    );

  }



  export default Login;



 

  