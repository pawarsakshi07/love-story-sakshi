const MAX_SIZE = 24 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/create" && request.method === "POST") {
      return createPage(request, env);
    }

    if (url.pathname.startsWith("/api/page/") && request.method === "GET") {
      const id = url.pathname.split("/").pop();

      if (!/^[a-zA-Z0-9_-]{6,20}$/.test(id)) {
        return json({ error: "Invalid link" }, 400);
      }

      const data = await env.LOVE_PAGES.get(id);

      if (!data) {
        return json({ error: "Love page not found" }, 404);
      }

      return new Response(data, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60"
        }
      });
    }

    if (url.pathname.startsWith("/l/")) {
      return new Response(viewerHTML(), {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }

    return new Response(creatorHTML(), {
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }
};

async function createPage(request, env) {
  try {
    const body = await request.json();
    const {
      yourName,
      theirName,
      occasion,
      wish,
      letter,
      photos,
      finalPhoto,
      secret
    } = body;

    if (!yourName || !theirName || !wish || !letter) {
      return json({ error: "Please fill all required fields." }, 400);
    }

    const page = {
      yourName: String(yourName).slice(0, 60),
      theirName: String(theirName).slice(0, 60),
      occasion: String(occasion || "For You").slice(0, 60),
      wish: String(wish).slice(0, 1500),
      letter: String(letter).slice(0, 5000),
      photos: Array.isArray(photos) ? photos.slice(0, 8) : [],
      finalPhoto: finalPhoto || "",
      secret: String(secret || "").slice(0, 50),
      createdAt: Date.now()
    };

    const encoded = JSON.stringify(page);

    if (new TextEncoder().encode(encoded).length > MAX_SIZE) {
      return json({
        error: "The photos are too large. Please use fewer or smaller photos."
      }, 413);
    }

    let id;
    do {
      id = randomId();
    } while (await env.LOVE_PAGES.get(id));

    await env.LOVE_PAGES.put(id, encoded, {
      expirationTtl: 60 * 60 * 24 * 365
    });

    return json({ success: true, id });
  } catch (error) {
    return json({
      error: "Something went wrong while creating the page."
    }, 500);
  }
}

function creatorHTML() {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Create Your Love Page ❤️</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:Arial,sans-serif;background:linear-gradient(135deg,#fff0f5,#ffe4ec,#fff);color:#4a1d2f}
.container{width:92%;max-width:700px;margin:30px auto;background:#fff;padding:25px;border-radius:25px;box-shadow:0 10px 35px rgba(120,30,70,.15)}
h1{text-align:center;color:#d6336c;margin-bottom:5px}
.subtitle{text-align:center;color:#777;margin-bottom:25px}
label{display:block;margin-top:17px;margin-bottom:7px;font-weight:bold}
input,textarea,select{width:100%;padding:13px;border:1px solid #e5b9c9;border-radius:12px;font-size:15px;outline:none}
textarea{min-height:120px;resize:vertical}
.photoBox{background:#fff5f8;border:1px dashed #dc7195;padding:15px;border-radius:15px;margin-top:10px}
button{width:100%;border:0;padding:15px;border-radius:14px;background:#d6336c;color:#fff;font-size:17px;font-weight:bold;margin-top:25px}
button:disabled{opacity:.6}
.note{font-size:13px;color:#777;margin-top:8px}
#result{display:none;margin-top:20px;padding:18px;background:#f0fff5;border-radius:15px}
.link{word-break:break-all;background:#fff;padding:12px;border-radius:10px;margin-top:10px}
.copy{background:#7b2cbf}
.heart{text-align:center;font-size:40px}
</style>
</head>
<body>
<div class="container">
<div class="heart">💗</div>
<h1>Create Your Love Page</h1>
<div class="subtitle">Create something special and send it to someone you love.</div>

<label>Your Name *</label>
<input id="yourName" placeholder="Your name">

<label>Their Name *</label>
<input id="theirName" placeholder="Their name">

<label>Occasion</label>
<select id="occasion">
<option>Just Because ❤️</option>
<option>Birthday 🎂</option>
<option>Anniversary 💕</option>
<option>Valentine's Day 💘</option>
<option>Our Special Day ✨</option>
<option>Other</option>
</select>

<label>First Page Wish *</label>
<textarea id="wish" placeholder="Write a sweet wish or message..."></textarea>

<label>Your Letter *</label>
<textarea id="letter" placeholder="Write your heart out..."></textarea>

<label>Photos</label>
<div class="photoBox">
<input id="photos" type="file" accept="image/*" multiple>
<div class="note">You can select up to 8 photos. Photos will automatically be resized.</div>
</div>

<label>Final Special Photo</label>
<div class="photoBox">
<input id="finalPhoto" type="file" accept="image/*">
<div class="note">This photo appears on the final page.</div>
</div>

<label>Secret Code (Optional)</label>
<input id="secret" type="text" placeholder="Example: oursecret">

<div class="note">If you enter a code, the recipient must enter it before seeing the page.</div>

<button id="generate" onclick="generatePage()">💗 Generate My Love Page</button>

<div id="result">
<h3>🎉 Your Love Page is Ready!</h3>
<p>Copy this link and send it:</p>
<div class="link" id="generatedLink"></div>
<button class="copy" onclick="copyLink()">📋 Copy Link</button>
</div>
</div>

<script>
async function compressImage(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();

    reader.onload=()=>{
      const img=new Image();

      img.onload=()=>{
        const max=1200;
        let w=img.width;
        let h=img.height;

        if(w>max){
          h=h*max/w;
          w=max;
        }

        const canvas=document.createElement("canvas");
        canvas.width=w;
        canvas.height=h;

        canvas.getContext("2d").drawImage(img,0,0,w,h);

        canvas.toBlob(blob=>{
          const r=new FileReader();
          r.onload=()=>resolve(r.result);
          r.onerror=reject;
          r.readAsDataURL(blob);
        },"image/jpeg",.72);
      };

      img.onerror=reject;
      img.src=reader.result;
    };

    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

async function generatePage(){
  const btn=document.getElementById("generate");

  const yourName=document.getElementById("yourName").value.trim();
  const theirName=document.getElementById("theirName").value.trim();
  const occasion=document.getElementById("occasion").value;
  const wish=document.getElementById("wish").value.trim();
  const letter=document.getElementById("letter").value.trim();
  const secret=document.getElementById("secret").value.trim();

  const files=Array.from(document.getElementById("photos").files).slice(0,8);
  const finalFile=document.getElementById("finalPhoto").files[0];

  if(!yourName||!theirName||!wish||!letter){
    alert("Please fill Your Name, Their Name, Wish and Letter.");
    return;
  }

  btn.disabled=true;
  btn.innerText="Creating your page... 💗";

  try{
    const photos=[];

    for(const file of files){
      photos.push(await compressImage(file));
    }

    const finalPhoto=finalFile ? await compressImage(finalFile) : "";

    const response=await fetch("/api/create",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        yourName,
        theirName,
        occasion,
        wish,
        letter,
        photos,
        finalPhoto,
        secret
      })
    });

    const data=await response.json();

    if(!response.ok){
      throw new Error(data.error || "Unable to create page.");
    }

    document.getElementById("generatedLink").innerText=
      location.origin+"/l/"+data.id;

    document.getElementById("result").style.display="block";

    btn.innerText="❤️ Page Created";

    window.scrollTo({
      top:document.body.scrollHeight,
      behavior:"smooth"
    });

  }catch(error){
    alert(error.message);
    btn.disabled=false;
    btn.innerText="💗 Generate My Love Page";
  }
}

function copyLink(){
  const link=document.getElementById("generatedLink").innerText;
  navigator.clipboard.writeText(link);
  alert("Link copied! 💗");
}
</script>
</body>
</html>`;
}

function viewerHTML() {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Our Love Story ❤️</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font-family:Georgia,serif;background:linear-gradient(135deg,#fff0f5,#ffe0ea,#fff);color:#4a1d2f}
.page{min-height:100vh;display:none;align-items:center;justify-content:center;padding:25px}
.page.active{display:flex}
.card{width:100%;max-width:700px;background:rgba(255,255,255,.95);padding:28px;border-radius:28px;text-align:center;box-shadow:0 15px 45px rgba(100,20,50,.15)}
h1{color:#d6336c;font-size:34px}
h2{color:#b42359}
.message{font-size:20px;line-height:1.7;white-space:pre-wrap}
.heart{font-size:55px}
.gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:20px}
.gallery img{width:100%;height:190px;object-fit:cover;border-radius:16px}
.letter{text-align:left;font-size:18px;line-height:1.8;white-space:pre-wrap}
.finalPhoto{width:100%;max-height:500px;object-fit:cover;border-radius:20px;margin-top:15px}
.name{font-size:35px;color:#d6336c;margin-top:20px;font-weight:bold}
.nav{display:flex;gap:10px;justify-content:center;margin-top:25px}
.nav button{border:0;padding:12px 20px;border-radius:12px;background:#d6336c;color:#fff;font-size:15px}
.secretInput{padding:13px;width:100%;border:1px solid #ddd;border-radius:12px;margin-top:15px}
.secretButton{background:#d6336c;color:#fff;border:0;padding:13px 25px;border-radius:12px;margin-top:12px}
</style>
</head>
<body>

<div id="loading" style="text-align:center;padding:60px 20px;font-size:20px">
💗 Opening your special page...
</div>

<div class="page" id="secretPage">
<div class="card">
<div class="heart">🔐</div>
<h2>This page is private ❤️</h2>
<p>Enter the secret code.</p>
<input id="secretInput" class="secretInput" placeholder="Enter secret code">
<button class="secretButton" onclick="unlock()">Open ❤️</button>
<p id="wrong" style="color:#d6336c"></p>
</div>
</div>

<div class="page" id="page1">
<div class="card">
<div class="heart">💗</div>
<h2 id="occasion"></h2>
<h1 id="title"></h1>
<div class="message" id="wish"></div>
<div class="nav">
<button onclick="nextPage()">Next ❤️</button>
</div>
</div>
</div>

<div class="page" id="page2">
<div class="card">
<div class="heart">📸</div>
<h1>Our Memories</h1>
<p>Some little moments that mean a lot. ❤️</p>
<div class="gallery" id="gallery"></div>
<div class="nav">
<button onclick="prevPage()">← Back</button>
<button onclick="nextPage()">Next ❤️</button>
</div>
</div>
</div>

<div class="page" id="page3">
<div class="card">
<div class="heart">💌</div>
<h1>A Letter For You</h1>
<div class="letter" id="letter"></div>
<div class="nav">
<button onclick="prevPage()">← Back</button>
<button onclick="nextPage()">Next ❤️</button>
</div>
</div>
</div>

<div class="page" id="page4">
<div class="card">
<div class="heart">❤️</div>
<h1>And Finally...</h1>
<img id="finalPhoto" class="finalPhoto">
<div class="name" id="finalName"></div>
<p style="font-size:20px">With all my heart, always. ❤️</p>
<div class="nav">
<button onclick="prevPage()">← Back</button>
</div>
</div>
</div>

<script>
let data=null;
let currentPage=1;

async function loadPage(){
  const id=location.pathname.split("/").pop();

  try{
    const r=await fetch("/api/page/"+id);

    if(!r.ok) throw new Error();

    data=await r.json();

    document.getElementById("loading").style.display="none";

    if(data.secret){
      document.getElementById("secretPage").classList.add("active");
    }else{
      startStory();
    }

  }catch(e){
    document.getElementById("loading").innerHTML=
      "Sorry, this love page could not be found. 💔";
  }
}

function unlock(){
  if(document.getElementById("secretInput").value===data.secret){
    document.getElementById("secretPage").classList.remove("active");
    startStory();
  }else{
    document.getElementById("wrong").innerText=
      "Wrong code. Try again ❤️";
  }
}

function startStory(){
  document.getElementById("occasion").innerText=data.occasion;
  document.getElementById("title").innerText="For "+data.theirName+" ❤️";
  document.getElementById("wish").innerText=data.wish;
  document.getElementById("letter").innerText=data.letter;

  const gallery=document.getElementById("gallery");
  gallery.innerHTML="";

  if(data.photos && data.photos.length){
    data.photos.forEach(p=>{
      const img=document.createElement("img");
      img.src=p;
      gallery.appendChild(img);
    });
  }else{
    gallery.innerHTML="<p>No photos were added. ❤️</p>";
  }

  if(data.finalPhoto){
    document.getElementById("finalPhoto").src=data.finalPhoto;
  }else{
    document.getElementById("finalPhoto").style.display="none";
  }

  document.getElementById("finalName").innerText=data.theirName;

  showPage(1);
}

function showPage(n){
  document.querySelectorAll(".page")
    .forEach(p=>p.classList.remove("active"));

  document.getElementById("page"+n).classList.add("active");

  currentPage=n;

  scrollTo({
    top:0,
    behavior:"smooth"
  });
}

function nextPage(){
  if(currentPage<4) showPage(currentPage+1);
}

function prevPage(){
  if(currentPage>1) showPage(currentPage-1);
}

loadPage();
</script>
</body>
</html>`;
}

function randomId(){
  const chars="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id="";

  for(let i=0;i<10;i++){
    id+=chars[Math.floor(Math.random()*chars.length)];
  }

  return id;
}

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "Content-Type":"application/json",
      "Access-Control-Allow-Origin":"*"
    }
  });
}
