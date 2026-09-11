const defaultProducts = [
  {id:1,name:"Chicken Burger",price:89,category:"Meals"},
  {id:2,name:"Cheese Burger",price:109,category:"Meals"},
  {id:3,name:"Chicken Rice",price:99,category:"Meals"},
  {id:4,name:"Fries",price:49,category:"Sides"},
  {id:5,name:"Siomai",price:45,category:"Sides"},
  {id:6,name:"Iced Tea",price:35,category:"Drinks"},
  {id:7,name:"Soft Drink",price:30,category:"Drinks"},
  {id:8,name:"Bottled Water",price:25,category:"Drinks"}
];

const state = {
  products: JSON.parse(localStorage.getItem("qr_products") || "null") || defaultProducts,
  transactions: JSON.parse(localStorage.getItem("qr_transactions") || "[]"),
  cart: [],
  category: "All",
  paymentMethod: "QR Ph",
  currentReceipt: null,
  store: JSON.parse(localStorage.getItem("qr_store") || "null") || {
    name:"My Food Stall", subtitle:"Digital Receipt POS", qrAccount:""
  }
};

const money = n => "₱" + Number(n).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
const save = () => {
  localStorage.setItem("qr_products",JSON.stringify(state.products));
  localStorage.setItem("qr_transactions",JSON.stringify(state.transactions));
  localStorage.setItem("qr_store",JSON.stringify(state.store));
};

function nextOrderNo(){
  const last = Number(localStorage.getItem("qr_order_no") || "1000") + 1;
  localStorage.setItem("qr_order_no",last);
  return "#" + last;
}

let orderNo = nextOrderNo();

function renderHeader(){
  document.getElementById("headerStore").textContent = state.store.name;
}

function categories(){
  return ["All", ...new Set(state.products.map(p=>p.category).filter(Boolean))];
}

function renderCategories(){
  const row=document.getElementById("categoryRow");
  row.innerHTML=categories().map(c=>`<button class="category-btn ${c===state.category?"active":""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");
  row.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{state.category=b.dataset.cat;renderCategories();renderProducts();});
}

function renderProducts(){
  const grid=document.getElementById("productGrid");
  const list=state.products.filter(p=>state.category==="All" || p.category===state.category);
  grid.innerHTML=list.map(p=>`
    <button class="product-card" data-product="${p.id}">
      <div class="product-name">${escapeHtml(p.name)}</div>
      <div class="product-price">${money(p.price)}</div>
    </button>`).join("");
  grid.querySelectorAll("[data-product]").forEach(b=>b.onclick=()=>addToCart(Number(b.dataset.product)));
}

function addToCart(id){
  const item=state.cart.find(x=>x.id===id);
  if(item)item.qty++;
  else state.cart.push({...state.products.find(p=>p.id===id),qty:1});
  renderCart();
}

function changeQty(id,delta){
  const item=state.cart.find(x=>x.id===id);
  if(!item)return;
  item.qty+=delta;
  if(item.qty<=0)state.cart=state.cart.filter(x=>x.id!==id);
  renderCart();
}

function totals(){
  return state.cart.reduce((s,x)=>s+x.price*x.qty,0);
}

function renderCart(){
  const el=document.getElementById("cartItems");
  const count=state.cart.reduce((s,x)=>s+x.qty,0);
  document.getElementById("orderNumber").textContent=orderNo;
  document.getElementById("itemCount").textContent=`${count} item${count===1?"":"s"}`;
  if(!state.cart.length){
    el.innerHTML=`<div class="empty-state">Tap a product to add it to the order.</div>`;
  }else{
    el.innerHTML=state.cart.map(x=>`
      <div class="cart-item">
        <div class="cart-main"><div class="cart-name">${escapeHtml(x.name)}</div><div class="cart-price">${money(x.price)} each</div></div>
        <div class="qty-controls">
          <button class="qty-btn" data-minus="${x.id}">−</button>
          <strong>${x.qty}</strong>
          <button class="qty-btn" data-plus="${x.id}">+</button>
        </div>
        <strong>${money(x.price*x.qty)}</strong>
      </div>`).join("");
    el.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>changeQty(Number(b.dataset.minus),-1));
    el.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>changeQty(Number(b.dataset.plus),1));
  }
  document.getElementById("subtotal").textContent=money(totals());
  document.getElementById("total").textContent=money(totals());
  document.getElementById("checkoutBtn").disabled=!state.cart.length;
}

function openModal(id){document.getElementById(id).classList.remove("hidden")}
function closeModal(id){document.getElementById(id).classList.add("hidden")}

function openPayment(){
  document.getElementById("payTotal").textContent=money(totals());
  document.getElementById("cashReceived").value="";
  document.getElementById("changeAmount").textContent=money(0);
  selectPayment("QR Ph");
  openModal("paymentModal");
}

function selectPayment(method){
  state.paymentMethod=method;
  document.querySelectorAll(".payment-option").forEach(b=>b.classList.toggle("selected",b.dataset.method===method));
  document.getElementById("cashFields").classList.toggle("hidden",method!=="Cash");
  document.getElementById("qrNote").classList.toggle("hidden",method!=="QR Ph");
  document.getElementById("confirmPaymentBtn").disabled=method==="Cash" && Number(document.getElementById("cashReceived").value||0)<totals();
}

function confirmPayment(){
  if(!state.cart.length)return;
  const received=Number(document.getElementById("cashReceived").value||0);
  if(state.paymentMethod==="Cash" && received<totals())return;
  const now=new Date();
  const tx={
    id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    orderNo,
    date:now.toISOString(),
    items:state.cart.map(x=>({id:x.id,name:x.name,price:x.price,qty:x.qty})),
    total:totals(),
    method:state.paymentMethod,
    cashReceived:state.paymentMethod==="Cash"?received:null
  };
  state.transactions.unshift(tx);
  state.currentReceipt=tx;
  save();
  closeModal("paymentModal");
  renderTransactions();
  renderReceiptModal();
  openModal("receiptModal");
}

function renderReceiptModal(){
  const tx=state.currentReceipt;
  if(!tx)return;
  document.getElementById("receiptPreview").innerHTML=receiptHtml(tx);
}

function receiptHtml(tx){
  const d=new Date(tx.date);
  return `
    <div class="receipt-title">${escapeHtml(state.store.name)}</div>
    <div class="receipt-meta">${escapeHtml(state.store.subtitle)} · ${d.toLocaleString("en-PH")}</div>
    <div class="receipt-line"><span>Order</span><strong>${tx.orderNo}</strong></div>
    ${tx.items.map(x=>`<div class="receipt-line"><span>${x.qty} × ${escapeHtml(x.name)}</span><span>${money(x.price*x.qty)}</span></div>`).join("")}
    <div class="receipt-line receipt-total"><span>TOTAL</span><span>${money(tx.total)}</span></div>
    <div class="receipt-line"><span>Payment</span><span>${tx.method}</span></div>
    ${tx.method==="Cash"?`<div class="receipt-line"><span>Change</span><span>${money(tx.cashReceived-tx.total)}</span></div>`:""}
    <div class="receipt-footer">Thank you for your purchase!</div>
    <div class="receipt-code">Receipt ID: ${tx.id.slice(0,8).toUpperCase()}</div>`;
}

function openCustomerReceipt(){
  document.getElementById("customerReceipt").innerHTML=receiptHtml(state.currentReceipt);
  closeModal("receiptModal");
  openModal("customerReceiptModal");
}

function newOrder(){
  closeModal("receiptModal");
  state.cart=[];
  orderNo=nextOrderNo();
  renderCart();
}

function renderTransactions(){
  const today=new Date().toDateString();
  const todays=state.transactions.filter(t=>new Date(t.date).toDateString()===today);
  document.getElementById("todaySales").textContent=money(todays.reduce((s,t)=>s+t.total,0));
  document.getElementById("todayOrders").textContent=todays.length;
  const list=document.getElementById("transactionList");
  list.innerHTML=state.transactions.length ? state.transactions.map(t=>{
    const d=new Date(t.date);
    return `<div class="transaction">
      <div><strong>${t.orderNo}</strong><div class="muted">${d.toLocaleString("en-PH")} · ${escapeHtml(t.method)}</div></div>
      <strong>${money(t.total)}</strong>
    </div>`;
  }).join("") : `<div class="empty-state">No transactions yet.</div>`;
}

function renderAdminProducts(){
  document.getElementById("productAdminList").innerHTML=state.products.map(p=>`
    <div class="admin-product">
      <div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.category)} · ${money(p.price)}</small></div>
      <button class="delete-btn" data-delete="${p.id}">Delete</button>
    </div>`).join("");
  document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{
    if(confirm("Delete this product?")){
      state.products=state.products.filter(p=>p.id!==Number(b.dataset.delete));
      save();renderAdminProducts();renderCategories();renderProducts();
    }
  });
}

function saveSettings(){
  state.store.name=document.getElementById("storeNameInput").value.trim()||"My Food Stall";
  state.store.subtitle=document.getElementById("storeSubtitleInput").value.trim()||"Digital Receipt POS";
  state.store.qrAccount=document.getElementById("qrAccountInput").value.trim();
  save();renderHeader();alert("Settings saved.");
}

function addProduct(){
  const name=document.getElementById("newProductName").value.trim();
  const price=Number(document.getElementById("newProductPrice").value);
  const category=document.getElementById("newProductCategory").value.trim()||"Other";
  if(!name||!price||price<0){alert("Enter a product name and valid price.");return}
  state.products.push({id:Date.now(),name,price,category});
  save();
  document.getElementById("newProductName").value="";
  document.getElementById("newProductPrice").value="";
  document.getElementById("newProductCategory").value="";
  closeModal("productModal");
  renderAdminProducts();renderCategories();renderProducts();
}

function switchView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  if(id==="transactionsView")renderTransactions();
  if(id==="productsView")renderAdminProducts();
  if(id==="settingsView"){
    document.getElementById("storeNameInput").value=state.store.name;
    document.getElementById("storeSubtitleInput").value=state.store.subtitle;
    document.getElementById("qrAccountInput").value=state.store.qrAccount;
  }
}

function exportCsv(){
  const rows=[["Order","Date","Payment","Total","Items"]];
  state.transactions.forEach(t=>rows.push([t.orderNo,new Date(t.date).toLocaleString("en-PH"),t.method,t.total,t.items.map(i=>`${i.qty}x ${i.name}`).join("; ")]));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="transactions.csv";a.click();
  URL.revokeObjectURL(a.href);
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
document.getElementById("checkoutBtn").onclick=openPayment;
document.getElementById("clearOrderBtn").onclick=()=>{if(state.cart.length && confirm("Clear current order?")){state.cart=[];renderCart()}};
document.getElementById("settingsBtn").onclick=()=>switchView("settingsView");
document.querySelectorAll(".payment-option").forEach(b=>b.onclick=()=>selectPayment(b.dataset.method));
document.getElementById("cashReceived").oninput=()=>selectPayment("Cash");
document.getElementById("confirmPaymentBtn").onclick=confirmPayment;
document.getElementById("newOrderBtn").onclick=newOrder;
document.getElementById("viewReceiptBtn").onclick=openCustomerReceipt;
document.getElementById("printReceiptBtn").onclick=()=>window.print();
document.getElementById("addProductBtn").onclick=()=>openModal("productModal");
document.getElementById("saveProductBtn").onclick=addProduct;
document.getElementById("saveSettingsBtn").onclick=saveSettings;
document.getElementById("exportBtn").onclick=exportCsv;
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));

renderHeader();renderCategories();renderProducts();renderCart();renderTransactions();
