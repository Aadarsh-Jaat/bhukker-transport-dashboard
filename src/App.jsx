import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc
} from "firebase/firestore";

import { db, auth } from "./firebase";
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "bhukker_transport_v1";

const defaultData = {
  trips: [],
  parties: [],
  transporters: [],
  trucks: [],
  drivers: [],
  cashbook: [],
  payments: [],
  openingPending: [],
  expenses: [], // Keep for backward compatibility
  driverAdvances: [],
  // NEW: General Expenses (non-trip expenses)
  generalExpenses: [],
  // NEW: Staff salaries (separate from driver advances)
  staffSalaries: [],
  // NEW: Owner's drawings/expenses
  ownerDrawings: [],
  settings: {
    companyName: "BHUKKER TRANSPORT CO.",
    tagline: "CUSTOMIZED TRANSPORT SOLUTION",
    gstin: "06AYYPS3604E3Z2",
    phone: "9812081416",
    address: "Shop No 135, New Sabzi Mandi, Panipat-132103, Haryana",
    jurisdiction: "Subject to Panipat Jurisdiction only",
    // NEW settings
    ownerName: "Owner",
    monthlyOwnerSalary: 0, // If owner wants to track theoretical salary
  },
  invoiceCounter: 1,
};

function useStorage(user) {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);

  const getDataRef = () => {
  if (!user) return null;
  return doc(db, "users", user.uid);
};

  useEffect(() => {
    const loadData = async () => {
      try {
        const ref = getDataRef();
        if (!ref) {
          setLoading(false);
          return;
        }

        const snap = await getDoc(ref);

        if (snap.exists()) {
          const saved = snap.data();

          setData({
            ...defaultData,
            ...saved,
            settings: {
              ...defaultData.settings,
              ...(saved.settings || {})
            },
            generalExpenses: saved.generalExpenses || [],
            staffSalaries: saved.staffSalaries || [],
            openingPending: saved.openingPending || [],
            ownerDrawings: saved.ownerDrawings || []
          });
        } else {
          await setDoc(ref, defaultData);
          setData(defaultData);
        }
      } catch (err) {
        console.error("Firestore load error:", err);
        alert("Could not load Firestore data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const save = useCallback(async (newData) => {
    setData(newData);

    const ref = getDataRef();
    if (ref) {
      await setDoc(ref, newData, { merge: true });
    }
  }, [user]);

  const update = useCallback(async (key, value) => {
    setData((prev) => {
      const next = { ...prev, [key]: value };

      const ref = getDataRef();
      if (ref) {
        setDoc(ref, next, { merge: true }).catch(err => {
          console.error("Firestore save error:", err);
          alert("Could not save data to Firestore");
        });
      }

      return next;
    });
  }, [user]);

  return { data, save, update, loading };
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

function fmt(n) {
  if (!n && n !== 0) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN");
}

function fmtN(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

function getMonthLabel(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m)-1]} ${y}`;
}

function monthOptions() {
  const opts = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    opts.push({ val, label: getMonthLabel(val) });
  }
  return opts;
}

function tripMonth(trip) {
  if (!trip.date) return "";
  return trip.date.slice(0, 7);
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,
      display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"2rem 1rem"
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#fff",borderRadius:12,width:wide?"860px":"520px",maxWidth:"98vw",
        boxShadow:"0 20px 60px rgba(0,0,0,0.15)"
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"1.25rem 1.5rem",borderBottom:"1px solid #eee"}}>
          <h3 style={{margin:0,fontSize:17,fontWeight:600,color:"#1a1a2e"}}>{title}</h3>
          <button onClick={onClose} style={{border:"none",background:"none",cursor:"pointer",
            fontSize:20,color:"#999",lineHeight:1}}>&times;</button>
        </div>
        <div style={{padding:"1.5rem"}}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, half }) {
  return (
    <div style={{marginBottom:14,width:half?"calc(50% - 6px)":"100%",display:"inline-block",
      verticalAlign:"top",marginRight:half?"12px":0}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:"#666",marginBottom:5,
        textTransform:"uppercase",letterSpacing:0.5}}>{label}</label>
      {children}
    </div>
  );
}

const inp = {
  width:"100%",padding:"9px 12px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:14,
  boxSizing:"border-box",outline:"none",fontFamily:"inherit",color:"#1a1a2e",background:"#fff"
};

function Input({ label, half, ...props }) {
  return (
    <Field label={label} half={half}>
      <input style={inp} {...props} />
    </Field>
  );
}

function Select({ label, half, children, ...props }) {
  return (
    <Field label={label} half={half}>
      <select style={{...inp,cursor:"pointer"}} {...props}>{children}</select>
    </Field>
  );
}

function Textarea({ label, ...props }) {
  return (
    <Field label={label}>
      <textarea style={{...inp,minHeight:70,resize:"vertical"}} {...props} />
    </Field>
  );
}

function Btn({ children, onClick, color, small, outline, danger }) {
  const bg = danger?"#e53935":color||"#1a1a2e";
  return (
    <button onClick={onClick} style={{
      padding:small?"6px 14px":"10px 20px",borderRadius:8,border:outline?`2px solid ${bg}`:"none",
      background:outline?"transparent":bg,color:outline?bg:"#fff",
      cursor:"pointer",fontSize:small?13:14,fontWeight:600,letterSpacing:0.2,
      display:"inline-flex",alignItems:"center",gap:6,transition:"opacity .15s",whiteSpace:"nowrap"
    }}
    onMouseOver={e=>e.currentTarget.style.opacity="0.85"}
    onMouseOut={e=>e.currentTarget.style.opacity="1"}>
      {children}
    </button>
  );
}

function Badge({ children, color }) {
  const colors = {
    green:{bg:"#e8f5e9",c:"#2e7d32"},
    red:{bg:"#ffebee",c:"#c62828"},
    orange:{bg:"#fff3e0",c:"#e65100"},
    blue:{bg:"#e3f2fd",c:"#1565c0"},
    gray:{bg:"#f5f5f5",c:"#555"},
    yellow:{bg:"#fffde7",c:"#f57f17"},
  };
  const s = colors[color]||colors.gray;
  return (
    <span style={{padding:"3px 10px",borderRadius:20,background:s.bg,color:s.c,
      fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>
  );
}

function Card({ children, style }) {
  return (
    <div style={{background:"#fff",borderRadius:12,border:"1px solid #eeeeee",
      padding:"1.25rem",boxShadow:"0 2px 8px rgba(0,0,0,0.04)",...style}}>{children}</div>
  );
}

function StatCard({ label, value, color, icon }) {
  const colors = {
    blue:{bg:"#e3f2fd",c:"#1565c0",ic:"#1976d2"},
    green:{bg:"#e8f5e9",c:"#2e7d32",ic:"#388e3c"},
    orange:{bg:"#fff3e0",c:"#e65100",ic:"#f57c00"},
    red:{bg:"#ffebee",c:"#c62828",ic:"#d32f2f"},
    purple:{bg:"#ede7f6",c:"#4527a0",ic:"#7b1fa2"},
    teal:{bg:"#e0f2f1",c:"#004d40",ic:"#00796b"},
  };
  const s = colors[color]||colors.blue;
  return (
    <div style={{background:s.bg,borderRadius:12,padding:"1.1rem 1.25rem",border:`1px solid ${s.bg}`}}>
      <div style={{fontSize:12,fontWeight:600,color:s.ic,textTransform:"uppercase",
        letterSpacing:0.5,marginBottom:8}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color:s.c}}>{value}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{textAlign:"center",padding:"3rem",color:"#aaa"}}>
      <div style={{fontSize:40,marginBottom:12}}>📋</div>
      <div style={{fontSize:14}}>{text}</div>
    </div>
  );
}

// ============================================================
// TRIP FORM
// ============================================================
function TripForm({ initial, parties, trucks, drivers, transporters, onSave, onClose }) {
  const blank = {
    date: new Date().toISOString().slice(0,10),
    truckNumber:"",ownerType:"own",fuelType:"diesel",driverName:"",
    partyName:"",partyMobile:"",from:"",to:"",material:"",
    freight:0,advance:0,paymentReceived:0,
    diesel:0,cng:0,toll:0,driverAdvance:0,otherExpense:0,
    paymentStatus:"pending",remarks:"",
    transporterName:"",transporterMobile:"",marketTruckNumber:"",
    amountPayable:0,commission:0,
  };
  const [f, setF] = useState(initial || blank);
  const set = (k, v) => setF(p => {
    const n = {...p, [k]: v};
    n.pending = Math.max(0, (Number(n.freight)||0) - (Number(n.advance)||0) - (Number(n.paymentReceived)||0));
    if (n.ownerType === "market") {
      n.commission = (Number(n.freight)||0) - (Number(n.amountPayable)||0);
    }
    n.netProfit = (Number(n.freight)||0) - (Number(n.diesel)||0) - (Number(n.cng)||0)
      - (Number(n.toll)||0) - (Number(n.driverAdvance)||0) - (Number(n.otherExpense)||0)
      - (n.ownerType==="market" ? Number(n.amountPayable)||0 : 0);
    return n;
  });

  const pending = Math.max(0,(Number(f.freight)||0)-(Number(f.advance)||0)-(Number(f.paymentReceived)||0));
  const netProfit = (Number(f.freight)||0)-(Number(f.diesel)||0)-(Number(f.cng)||0)
    -(Number(f.toll)||0)-(Number(f.driverAdvance)||0)-(Number(f.otherExpense)||0)
    -(f.ownerType==="market"?Number(f.amountPayable)||0:0);

  return (
    <div>
      <div style={{display:"flex",flexWrap:"wrap",gap:0}}>
        <Input label="Trip Date" type="date" value={f.date} onChange={e=>set("date",e.target.value)} half />
        <Select label="Truck Type" value={f.ownerType} onChange={e=>set("ownerType",e.target.value)} half>
          <option value="own">Own Truck</option>
          <option value="market">Market Truck Taken</option>
          <option value="given">Our Truck Given to Other</option>
        </Select>
        <Input label="Truck Number" value={f.truckNumber} onChange={e=>set("truckNumber",e.target.value)} half
          list="truck-list" placeholder="e.g. HR06AB1234" />
        <datalist id="truck-list">{trucks.map(t=><option key={t.id} value={t.number}/>)}</datalist>
        <Select label="Fuel Type" value={f.fuelType} onChange={e=>set("fuelType",e.target.value)} half>
          <option value="diesel">Diesel</option>
          <option value="cng">CNG</option>
        </Select>
        <Input label="Driver Name" value={f.driverName} onChange={e=>set("driverName",e.target.value)} half
          list="driver-list" />
        <datalist id="driver-list">{drivers.map(d=><option key={d.id} value={d.name}/>)}</datalist>
        <Input label="Party / Company" value={f.partyName} onChange={e=>set("partyName",e.target.value)} half
          list="party-list" />
        <datalist id="party-list">{parties.map(p=><option key={p.id} value={p.name}/>)}</datalist>
        <Input label="Party Mobile" value={f.partyMobile} onChange={e=>set("partyMobile",e.target.value)} half />
        <Input label="From Location" value={f.from} onChange={e=>set("from",e.target.value)} half />
        <Input label="To Location" value={f.to} onChange={e=>set("to",e.target.value)} half />
        <Input label="Material" value={f.material} onChange={e=>set("material",e.target.value)} half />
        <Input label="Freight Amount (₹)" type="number" value={f.freight} onChange={e=>set("freight",e.target.value)} half />
        <Input label="Advance Received (₹)" type="number" value={f.advance} onChange={e=>set("advance",e.target.value)} half />
        <Input label="Payment Received (₹)" type="number" value={f.paymentReceived} onChange={e=>set("paymentReceived",e.target.value)} half />
        <div style={{width:"calc(50% - 6px)",display:"inline-block",verticalAlign:"top",marginBottom:14}}>
          <div style={{background:"#f0f4ff",borderRadius:8,padding:"10px 14px"}}>
            <div style={{fontSize:12,color:"#666",fontWeight:600}}>PENDING</div>
            <div style={{fontSize:18,fontWeight:700,color:pending>0?"#c62828":"#2e7d32"}}>{fmt(pending)}</div>
          </div>
        </div>
      </div>

      <div style={{fontWeight:600,fontSize:13,color:"#666",margin:"12px 0 8px",
        textTransform:"uppercase",letterSpacing:0.5}}>Expenses</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:0}}>
        {f.fuelType==="diesel"
          ? <Input label="Diesel Expense (₹)" type="number" value={f.diesel} onChange={e=>set("diesel",e.target.value)} half />
          : <Input label="CNG Expense (₹)" type="number" value={f.cng} onChange={e=>set("cng",e.target.value)} half />
        }
        <Input label="Toll Expense (₹)" type="number" value={f.toll} onChange={e=>set("toll",e.target.value)} half />
        <Input label="Driver Advance (₹)" type="number" value={f.driverAdvance} onChange={e=>set("driverAdvance",e.target.value)} half />
        <Input label="Other Expenses (₹)" type="number" value={f.otherExpense} onChange={e=>set("otherExpense",e.target.value)} half />
      </div>

      {f.ownerType === "market" && (
        <>
          <div style={{fontWeight:600,fontSize:13,color:"#666",margin:"12px 0 8px",
            textTransform:"uppercase",letterSpacing:0.5}}>Market Truck Details</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:0}}>
            <Input label="Transporter Name" value={f.transporterName} onChange={e=>set("transporterName",e.target.value)} half
              list="trans-list" />
            <datalist id="trans-list">{transporters.map(t=><option key={t.id} value={t.name}/>)}</datalist>
            <Input label="Transporter Mobile" value={f.transporterMobile} onChange={e=>set("transporterMobile",e.target.value)} half />
            <Input label="Market Truck Number" value={f.marketTruckNumber} onChange={e=>set("marketTruckNumber",e.target.value)} half />
            <Input label="Amount Payable (₹)" type="number" value={f.amountPayable} onChange={e=>set("amountPayable",e.target.value)} half />
          </div>
          <div style={{background:"#e8f5e9",borderRadius:8,padding:"10px 14px",marginBottom:14}}>
            <div style={{fontSize:12,color:"#2e7d32",fontWeight:600}}>COMMISSION / PROFIT</div>
            <div style={{fontSize:18,fontWeight:700,color:"#2e7d32"}}>{fmt((Number(f.freight)||0)-(Number(f.amountPayable)||0))}</div>
          </div>
        </>
      )}

      <div style={{display:"flex",flexWrap:"wrap",gap:0}}>
        <Select label="Payment Status" value={f.paymentStatus} onChange={e=>set("paymentStatus",e.target.value)} half>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </Select>
        <div style={{width:"calc(50% - 6px)",display:"inline-block",verticalAlign:"top",marginBottom:14}}>
          <div style={{background:netProfit>=0?"#e8f5e9":"#ffebee",borderRadius:8,padding:"10px 14px"}}>
            <div style={{fontSize:12,color:netProfit>=0?"#2e7d32":"#c62828",fontWeight:600}}>NET PROFIT/LOSS</div>
            <div style={{fontSize:18,fontWeight:700,color:netProfit>=0?"#2e7d32":"#c62828"}}>{fmt(netProfit)}</div>
          </div>
        </div>
      </div>
      <Textarea label="Remarks" value={f.remarks} onChange={e=>set("remarks",e.target.value)} />

      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
        <Btn outline onClick={onClose}>Cancel</Btn>
        <Btn onClick={()=>onSave({
          ...f, pending, netProfit,
          commission: f.ownerType==="market"?(Number(f.freight)||0)-(Number(f.amountPayable)||0):0
        })}>Save Trip</Btn>
      </div>
    </div>
  );
}

// ============================================================
// PAGES
// ============================================================

function Dashboard({ data, selectedMonth, setSelectedMonth, navigate }) {
  const trips = data.trips.filter(t => tripMonth(t) === selectedMonth);
  const cash = data.cashbook.filter(c => c.date?.slice(0,7) === selectedMonth);
  const payments = data.payments.filter(p => p.date?.slice(0,7) === selectedMonth);

  const totalFreight = trips.reduce((s,t)=>s+(Number(t.freight)||0),0);
  const totalPending = trips.reduce((s,t)=>s+(Number(t.pending)||0),0);
  const totalProfit = trips.reduce((s,t)=>s+(Number(t.netProfit)||0),0);
  const cashIn = cash.filter(c=>c.type==="in").reduce((s,c)=>s+(Number(c.amount)||0),0);
  const cashOut = cash.filter(c=>c.type==="out").reduce((s,c)=>s+(Number(c.amount)||0),0);
  const diesel = trips.reduce((s,t)=>s+(Number(t.diesel)||0),0);
  const cng = trips.reduce((s,t)=>s+(Number(t.cng)||0),0);
  const advance = trips.reduce((s,t)=>s+(Number(t.advance)||0),0);
  const trucksOnTrip = data.trucks.filter(t=>t.status==="on_trip").length;
  const trucksAvail = data.trucks.filter(t=>t.status==="available").length;

  const recentTrips = [...data.trips].sort((a,b)=>b.date?.localeCompare(a.date)).slice(0,5);
  const recentPayments = [...data.payments].sort((a,b)=>b.date?.localeCompare(a.date)).slice(0,5);

  const today = new Date().toISOString().slice(0,10);
  const expiring = data.trucks.filter(t=>{
    const docs = [t.insuranceExpiry,t.fitnessExpiry,t.permitExpiry,t.pollutionExpiry];
    return docs.some(d=>d && d <= new Date(Date.now()+30*864e5).toISOString().slice(0,10));
  });

  const partyPending = {};
  data.trips.forEach(t=>{
    if ((Number(t.pending)||0)>0) {
      partyPending[t.partyName] = (partyPending[t.partyName]||0)+(Number(t.pending)||0);
    }
  });
  const topParties = Object.entries(partyPending).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return (
    
    <div>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{margin:0,fontSize:22,fontWeight:700,color:"#1a1a2e"}}>Dashboard</h2>
          <div style={{color:"#888",fontSize:14,marginTop:2}}>Business overview for {getMonthLabel(selectedMonth)}</div>
        </div>
        <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}
          style={{...inp,width:"auto",padding:"8px 14px"}}>
          {monthOptions().map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:24}}>
        <StatCard label="Total Trips" value={trips.length} color="blue" />
        <StatCard label="Total Freight" value={fmt(totalFreight)} color="green" />
        <StatCard label="Total Pending" value={fmt(totalPending)} color="red" />
        <StatCard label="Profit / Loss" value={fmt(totalProfit)} color={totalProfit>=0?"teal":"red"} />
        <StatCard label="Cash In" value={fmt(cashIn)} color="green" />
        <StatCard label="Cash Out" value={fmt(cashOut)} color="orange" />
        <StatCard label="Diesel Expense" value={fmt(diesel)} color="orange" />
        <StatCard label="CNG Expense" value={fmt(cng)} color="teal" />
        <StatCard label="Advance Given" value={fmt(advance)} color="purple" />
        <StatCard label="Trucks Available" value={trucksAvail} color="green" />
        <StatCard label="Trucks On Trip" value={trucksOnTrip} color="blue" />
      </div>

      <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
        <Btn onClick={()=>navigate("trips","add")}>+ Add Trip</Btn>
        <Btn onClick={()=>navigate("cashbook","add")} color="#1565c0">+ Cash Entry</Btn>
        <Btn onClick={()=>navigate("invoices")} color="#6a1b9a">Generate Invoice</Btn>
        <Btn onClick={()=>navigate("pending")} color="#c62828" outline>View Pending</Btn>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Card>
          <div style={{fontWeight:700,fontSize:15,marginBottom:14,color:"#1a1a2e"}}>Recent Trips</div>
          {recentTrips.length===0 ? <EmptyState text="No trips yet" /> : (
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{borderBottom:"2px solid #f0f0f0"}}>
                <th style={{textAlign:"left",padding:"6px 8px",color:"#888",fontWeight:600}}>Date</th>
                <th style={{textAlign:"left",padding:"6px 8px",color:"#888",fontWeight:600}}>Party</th>
                <th style={{textAlign:"left",padding:"6px 8px",color:"#888",fontWeight:600}}>Truck</th>
                <th style={{textAlign:"right",padding:"6px 8px",color:"#888",fontWeight:600}}>Freight</th>
              </tr></thead>
              <tbody>{recentTrips.map(t=>(
                <tr key={t.id} style={{borderBottom:"1px solid #f5f5f5"}}>
                  <td style={{padding:"7px 8px"}}>{t.date}</td>
                  <td style={{padding:"7px 8px",fontWeight:500}}>{t.partyName||"-"}</td>
                  <td style={{padding:"7px 8px",color:"#666"}}>{t.truckNumber||"-"}</td>
                  <td style={{padding:"7px 8px",textAlign:"right",fontWeight:600}}>{fmt(t.freight)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card>
          <div style={{fontWeight:700,fontSize:15,marginBottom:14,color:"#1a1a2e"}}>Party-wise Pending</div>
          {topParties.length===0 ? <EmptyState text="No pending amounts" /> : (
            <div>{topParties.map(([name, amt])=>(
              <div key={name} style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f5f5f5"}}>
                <div style={{fontWeight:500,fontSize:14}}>{name||"Unknown"}</div>
                <Badge color="red">{fmt(amt)}</Badge>
              </div>
            ))}</div>
          )}
        </Card>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <div style={{fontWeight:700,fontSize:15,marginBottom:14,color:"#1a1a2e"}}>Recent Payments</div>
          {recentPayments.length===0 ? <EmptyState text="No payments recorded" /> : (
            <div>{recentPayments.map(p=>(
              <div key={p.id} style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",padding:"9px 0",borderBottom:"1px solid #f5f5f5"}}>
                <div>
                  <div style={{fontWeight:500,fontSize:14}}>{p.partyName}</div>
                  <div style={{fontSize:12,color:"#888"}}>{p.date} · {p.mode||"Cash"}</div>
                </div>
                <Badge color="green">{fmt(p.amount)}</Badge>
              </div>
            ))}</div>
          )}
        </Card>
        <Card>
          <div style={{fontWeight:700,fontSize:15,marginBottom:14,color:"#1a1a2e"}}>⚠ Expiring Documents</div>
          {expiring.length===0
            ? <div style={{color:"#2e7d32",fontSize:14,padding:"1rem 0"}}>✓ All documents valid</div>
            : expiring.map(t=>(
              <div key={t.id} style={{padding:"8px 0",borderBottom:"1px solid #f5f5f5"}}>
                <div style={{fontWeight:600}}>{t.number}</div>
                <div style={{fontSize:12,color:"#e65100"}}>
                  {t.insuranceExpiry<=new Date(Date.now()+30*864e5).toISOString().slice(0,10)
                    && `Insurance: ${t.insuranceExpiry} `}
                  {t.fitnessExpiry<=new Date(Date.now()+30*864e5).toISOString().slice(0,10)
                    && `Fitness: ${t.fitnessExpiry}`}
                </div>
              </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function TripsPage({ data, update, navigate, openAdd }) {
  const [month, setMonth] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [partyF, setPartyF] = useState("");
  const [truckF, setTruckF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [showForm, setShowForm] = useState(openAdd||false);
  const [editing, setEditing] = useState(null);
  const [viewTrip, setViewTrip] = useState(null);

  useEffect(()=>{ if(openAdd) setShowForm(true); },[openAdd]);

  const filtered = data.trips.filter(t=>{
    if (tripMonth(t) !== month) return false;
    if (search && !`${t.partyName} ${t.truckNumber} ${t.driverName} ${t.from} ${t.to}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (partyF && t.partyName !== partyF) return false;
    if (truckF && t.truckNumber !== truckF) return false;
    if (statusF && t.paymentStatus !== statusF) return false;
    return true;
  }).sort((a,b)=>b.date?.localeCompare(a.date));

  const totalFreight = filtered.reduce((s,t)=>s+(Number(t.freight)||0),0);
  const totalPending = filtered.reduce((s,t)=>s+(Number(t.pending)||0),0);

  const saveTrip = (trip) => {
    const trips = [...data.trips];
    if (editing) {
      const idx = trips.findIndex(t=>t.id===editing.id);
      trips[idx] = { ...editing, ...trip };
    } else {
      trips.push({ ...trip, id: genId() });
    }
    update("trips", trips);
    setShowForm(false);
    setEditing(null);
  };

  const deleteTrip = (id) => {
    if (!confirm("Delete this trip?")) return;
    update("trips", data.trips.filter(t=>t.id!==id));
  };

  const parties = [...new Set(data.trips.map(t=>t.partyName).filter(Boolean))];
  const trucks = [...new Set(data.trips.map(t=>t.truckNumber).filter(Boolean))];

  const statusColor = {paid:"green",partial:"orange",pending:"red"};

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:"#1a1a2e"}}>Trips</h2>
        <Btn onClick={()=>{setEditing(null);setShowForm(true)}}>+ Add Trip</Btn>
      </div>

      <Card style={{marginBottom:16}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <select value={month} onChange={e=>setMonth(e.target.value)} style={{...inp,width:160}}>
            {monthOptions().map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <input placeholder="Search party, truck, driver..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{...inp,flex:1,minWidth:180}} />
          <select value={partyF} onChange={e=>setPartyF(e.target.value)} style={{...inp,width:160}}>
            <option value="">All Parties</option>
            {parties.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
          <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={{...inp,width:140}}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </Card>

      <div style={{display:"flex",gap:16,marginBottom:16,flexWrap:"wrap"}}>
        <StatCard label="Trips" value={filtered.length} color="blue" />
        <StatCard label="Total Freight" value={fmt(totalFreight)} color="green" />
        <StatCard label="Total Pending" value={fmt(totalPending)} color="red" />
      </div>

      <Card style={{overflowX:"auto"}}>
        {filtered.length===0 ? <EmptyState text="No trips found. Add your first trip!" /> : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:900}}>
            <thead><tr style={{background:"#f8f8f8",borderBottom:"2px solid #eee"}}>
              {["Date","Truck","Driver","Party","Route","Freight","Advance","Pending","Status",""].map(h=>(
                <th key={h} style={{textAlign:h===""||h==="Freight"||h==="Advance"||h==="Pending"?"right":"left",
                  padding:"10px 12px",color:"#666",fontWeight:700,fontSize:12,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{filtered.map(t=>(
              <tr key={t.id} style={{borderBottom:"1px solid #f0f0f0",cursor:"pointer"}}
                onClick={()=>setViewTrip(t)}>
                <td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>{t.date}</td>
                <td style={{padding:"10px 12px",fontWeight:600}}>{t.truckNumber||"-"}</td>
                <td style={{padding:"10px 12px"}}>{t.driverName||"-"}</td>
                <td style={{padding:"10px 12px",fontWeight:500}}>{t.partyName||"-"}</td>
                <td style={{padding:"10px 12px",color:"#666"}}>{t.from}→{t.to}</td>
                <td style={{padding:"10px 12px",textAlign:"right",fontWeight:600}}>{fmt(t.freight)}</td>
                <td style={{padding:"10px 12px",textAlign:"right"}}>{fmt(t.advance)}</td>
                <td style={{padding:"10px 12px",textAlign:"right",fontWeight:600,color:(Number(t.pending)||0)>0?"#c62828":"#2e7d32"}}>{fmt(t.pending)}</td>
                <td style={{padding:"10px 12px"}}><Badge color={statusColor[t.paymentStatus]||"gray"}>{t.paymentStatus}</Badge></td>
                <td style={{padding:"10px 12px",textAlign:"right"}} onClick={e=>e.stopPropagation()}>
                  <Btn small outline onClick={()=>{setEditing(t);setShowForm(true)}}>Edit</Btn>
                  {" "}
                  <Btn small danger onClick={()=>deleteTrip(t.id)}>Del</Btn>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>

      <Modal open={showForm} onClose={()=>{setShowForm(false);setEditing(null)}}
        title={editing?"Edit Trip":"New Trip"} wide>
        <TripForm initial={editing} parties={data.parties} trucks={data.trucks}
          drivers={data.drivers} transporters={data.transporters}
          onSave={saveTrip} onClose={()=>{setShowForm(false);setEditing(null)}} />
      </Modal>

      <Modal open={!!viewTrip} onClose={()=>setViewTrip(null)} title="Trip Details" wide>
        {viewTrip && <TripDetail trip={viewTrip} />}
      </Modal>
    </div>
  );
}

function TripDetail({ trip }) {
  const expenses = (Number(trip.diesel)||0)+(Number(trip.cng)||0)+(Number(trip.toll)||0)
    +(Number(trip.driverAdvance)||0)+(Number(trip.otherExpense)||0);
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        {[["Date",trip.date],["Truck",trip.truckNumber],["Driver",trip.driverName],
          ["Party",trip.partyName],["Mobile",trip.partyMobile],["Route",`${trip.from} → ${trip.to}`],
          ["Material",trip.material],["Type",trip.ownerType]
        ].map(([l,v])=>(
          <div key={l}><div style={{fontSize:12,color:"#888",fontWeight:600}}>{l}</div>
          <div style={{fontWeight:500}}>{v||"-"}</div></div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        <StatCard label="Freight" value={fmt(trip.freight)} color="blue" />
        <StatCard label="Advance" value={fmt(trip.advance)} color="orange" />
        <StatCard label="Pending" value={fmt(trip.pending)} color="red" />
      </div>
      <Card style={{marginBottom:16}}>
        <div style={{fontWeight:700,marginBottom:12}}>Expense Breakdown</div>
        {[["Diesel",trip.diesel],["CNG",trip.cng],["Toll",trip.toll],
          ["Driver Advance",trip.driverAdvance],["Other",trip.otherExpense]
        ].map(([l,v])=>v>0&&(
          <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",
            borderBottom:"1px solid #f0f0f0"}}>
            <span style={{color:"#666"}}>{l}</span>
            <span style={{fontWeight:600}}>{fmt(v)}</span>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",fontWeight:700}}>
          <span>Total Expenses</span><span>{fmt(expenses)}</span>
        </div>
      </Card>
      {trip.ownerType==="market"&&(
        <Card style={{background:"#e8f5e9",marginBottom:16}}>
          <div style={{fontWeight:700,marginBottom:8}}>Market Truck</div>
          <div>Transporter: {trip.transporterName}</div>
          <div>Amount Payable: {fmt(trip.amountPayable)}</div>
          <div style={{fontWeight:700,color:"#2e7d32"}}>Commission: {fmt(trip.commission)}</div>
        </Card>
      )}
      <div style={{padding:"12px 16px",borderRadius:8,background:trip.netProfit>=0?"#e8f5e9":"#ffebee"}}>
        <span style={{fontWeight:700,fontSize:16,color:trip.netProfit>=0?"#2e7d32":"#c62828"}}>
          Net Profit/Loss: {fmt(trip.netProfit)}
        </span>
      </div>
      {trip.remarks&&<div style={{marginTop:12,color:"#666"}}>Remarks: {trip.remarks}</div>}
    </div>
  );
}

function PartiesPage({ data, update }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState(null);
  const blank = { name:"",contact:"",mobile:"",address:"",gst:"",notes:"" };
  const [f, setF] = useState(blank);

  const save = () => {
    if (!f.name) return alert("Party name required");
    const list = [...data.parties];
    if (editing) {
      const idx = list.findIndex(p=>p.id===editing.id);
      list[idx] = { ...editing, ...f };
    } else {
      list.push({ ...f, id: genId() });
    }
    update("parties", list);
    setShowForm(false);
    setEditing(null);
    setF(blank);
  };

  const del = (id) => {
    if (!confirm("Delete party?")) return;
    update("parties", data.parties.filter(p=>p.id!==id));
  };

  const partyStats = (name) => {
    const trips = data.trips.filter(t=>t.partyName===name);
    const payments = data.payments.filter(p=>p.partyName===name);
    return {
      freight: trips.reduce((s,t)=>s+(Number(t.freight)||0),0),
      received: trips.reduce((s,t)=>s+(Number(t.advance)||0)+(Number(t.paymentReceived)||0),0),
      pending: trips.reduce((s,t)=>s+(Number(t.pending)||0),0),
      trips: trips.length,
    };
  };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:"#1a1a2e"}}>Parties / Customers</h2>
        <Btn onClick={()=>{setF(blank);setEditing(null);setShowForm(true)}}>+ Add Party</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
        {data.parties.length===0&&<EmptyState text="No parties added yet" />}
        {data.parties.map(p=>{
          const s = partyStats(p.name);
          return (
            <Card key={p.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{fontWeight:700,fontSize:16}}>{p.name}</div>
                  <div style={{color:"#888",fontSize:13}}>{p.contact} · {p.mobile}</div>
                  {p.gst&&<div style={{fontSize:12,color:"#666"}}>GST: {p.gst}</div>}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <Btn small outline onClick={()=>{setEditing(p);setF(p);setShowForm(true)}}>Edit</Btn>
                  <Btn small danger onClick={()=>del(p.id)}>Del</Btn>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                <div style={{background:"#e3f2fd",borderRadius:8,padding:"8px",textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#1565c0",fontWeight:600}}>FREIGHT</div>
                  <div style={{fontWeight:700,color:"#1565c0",fontSize:14}}>{fmt(s.freight)}</div>
                </div>
                <div style={{background:"#e8f5e9",borderRadius:8,padding:"8px",textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#2e7d32",fontWeight:600}}>RECEIVED</div>
                  <div style={{fontWeight:700,color:"#2e7d32",fontSize:14}}>{fmt(s.received)}</div>
                </div>
                <div style={{background:"#ffebee",borderRadius:8,padding:"8px",textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#c62828",fontWeight:600}}>PENDING</div>
                  <div style={{fontWeight:700,color:"#c62828",fontSize:14}}>{fmt(s.pending)}</div>
                </div>
              </div>
              <div style={{fontSize:13,color:"#666",cursor:"pointer",textDecoration:"underline"}}
                onClick={()=>setView(p)}>View Ledger ({s.trips} trips) →</div>
            </Card>
          );
        })}
      </div>

      <Modal open={showForm} onClose={()=>{setShowForm(false);setEditing(null)}} title={editing?"Edit Party":"New Party"}>
        <Input label="Party Name" value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} />
        <Input label="Contact Person" value={f.contact} onChange={e=>setF(p=>({...p,contact:e.target.value}))} />
        <Input label="Mobile" value={f.mobile} onChange={e=>setF(p=>({...p,mobile:e.target.value}))} half />
        <Input label="GST Number" value={f.gst} onChange={e=>setF(p=>({...p,gst:e.target.value}))} half />
        <Textarea label="Address" value={f.address} onChange={e=>setF(p=>({...p,address:e.target.value}))} />
        <Textarea label="Notes" value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} />
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Btn outline onClick={()=>setShowForm(false)}>Cancel</Btn>
          <Btn onClick={save}>Save Party</Btn>
        </div>
      </Modal>

      <Modal open={!!view} onClose={()=>setView(null)} title={`Ledger: ${view?.name}`} wide>
        {view&&<PartyLedger party={view} data={data} />}
      </Modal>
    </div>
  );
}

function PartyLedger({ party, data }) {
  const trips = data.trips.filter(t=>t.partyName===party.name).sort((a,b)=>b.date?.localeCompare(a.date));
  const payments = data.payments.filter(p=>p.partyName===party.name).sort((a,b)=>b.date?.localeCompare(a.date));
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        <StatCard label="Total Freight" value={fmt(trips.reduce((s,t)=>s+(Number(t.freight)||0),0))} color="blue" />
        <StatCard label="Total Received" value={fmt(trips.reduce((s,t)=>s+(Number(t.advance)||0)+(Number(t.paymentReceived)||0),0))} color="green" />
        <StatCard label="Total Pending" value={fmt(trips.reduce((s,t)=>s+(Number(t.pending)||0),0))} color="red" />
      </div>
      <div style={{fontWeight:700,marginBottom:10}}>All Trips</div>
      {trips.map(t=>(
        <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #f0f0f0"}}>
          <div>
            <div style={{fontWeight:500}}>{t.date} · {t.truckNumber}</div>
            <div style={{fontSize:12,color:"#888"}}>{t.from}→{t.to} · {t.material}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontWeight:600}}>{fmt(t.freight)}</div>
            <div style={{fontSize:12,color:Number(t.pending)>0?"#c62828":"#2e7d32"}}>
              Pending: {fmt(t.pending)}
            </div>
          </div>
        </div>
      ))}
      {payments.length>0&&<>
        <div style={{fontWeight:700,margin:"16px 0 10px"}}>Payment History</div>
        {payments.map(p=>(
          <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f0f0f0"}}>
            <div>
              <div style={{fontWeight:500}}>{p.date} · {p.mode}</div>
              {p.reference&&<div style={{fontSize:12,color:"#888"}}>Ref: {p.reference}</div>}
            </div>
            <Badge color="green">{fmt(p.amount)}</Badge>
          </div>
        ))}
      </>}
    </div>
  );
}
// ============================================================
// TRUCK DETAIL MODAL - Add this BEFORE TrucksPage
// ============================================================
function TruckDetailModal({ truck, data, onClose }) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  
  const allTrips = data.trips.filter(t => t.truckNumber === truck.number);
  const filteredTrips = allTrips.filter(t => tripMonth(t) === selectedMonth);
  
  const allGeneralExpenses = (data.generalExpenses || []).filter(e => e.vehicleNumber === truck.number);
  const filteredGeneralExpenses = allGeneralExpenses.filter(e => e.date?.slice(0,7) === selectedMonth);
  
  const truckDriver = data.drivers.find(d => d.truck === truck.number);
  const driverSalaries = (data.staffSalaries || []).filter(s => 
    s.staffName === truckDriver?.name && s.salaryMonth === selectedMonth
  );
  
  const tripIncome = filteredTrips.reduce((s, t) => s + (Number(t.freight) || 0), 0);
  const tripExpensesTotal = filteredTrips.reduce((s, t) => s + 
    (Number(t.diesel) || 0) + (Number(t.cng) || 0) + (Number(t.toll) || 0) + 
    (Number(t.driverAdvance) || 0) + (Number(t.otherExpense) || 0), 0);
  
  const totalGeneralExpenses = filteredGeneralExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalDriverSalary = driverSalaries.reduce((s, sal) => s + (Number(sal.netAmount) || 0), 0);
  
  const monthlyEmi = Number(truck.emiAmount) || 0;
  const totalExpenses = tripExpensesTotal + totalGeneralExpenses + totalDriverSalary + monthlyEmi;
  const netProfit = tripIncome - totalExpenses;
  
  const expensesByCategory = {};
  filteredGeneralExpenses.forEach(e => {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + (Number(e.amount) || 0);
  });

  return (
    <div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20}}>
        <div><div style={{fontSize:12, color:"#888"}}>Truck Number</div><div style={{fontWeight:700, fontSize:18}}>{truck.number}</div></div>
        <div><div style={{fontSize:12, color:"#888"}}>Ownership / Fuel</div><div>{truck.ownership} · {truck.fuelType}</div></div>
        <div><div style={{fontSize:12, color:"#888"}}>Driver</div><div>{truck.driver || "Not Assigned"}</div></div>
        <div><div style={{fontSize:12, color:"#888"}}>Status</div><Badge color={truck.status === "available" ? "green" : "blue"}>{truck.status}</Badge></div>
      </div>
      
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
        <div style={{fontWeight:700, fontSize:15}}>Monthly Performance</div>
        <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} style={{...inp, width:160}}>
          {monthOptions().map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
      </div>
      
      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20}}>
        <StatCard label="Trips" value={filteredTrips.length} color="blue" />
        <StatCard label="Total Income" value={fmt(tripIncome)} color="green" />
        <StatCard label="Total Expenses" value={fmt(totalExpenses)} color="red" />
        <StatCard label="Net Profit/Loss" value={fmt(netProfit)} color={netProfit >= 0 ? "teal" : "red"} />
      </div>
      
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20}}>
        <Card>
          <div style={{fontWeight:700, marginBottom:12}}>🚛 Expenses Breakdown</div>
          <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eee"}}>
            <span>Trip Expenses (Diesel, Toll, etc.)</span><span>{fmt(tripExpensesTotal)}</span>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eee"}}>
            <span>General Expenses (Tyre, Service, etc.)</span><span>{fmt(totalGeneralExpenses)}</span>
          </div>
          {Object.entries(expensesByCategory).map(([cat, amt]) => (
            <div key={cat} style={{display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12, marginLeft:10}}>
              <span style={{color:"#666"}}>└ {cat}</span><span>{fmt(amt)}</span>
            </div>
          ))}
          <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eee"}}>
            <span>Driver Salary</span><span>{fmt(totalDriverSalary)}</span>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eee"}}>
            <span>Monthly EMI</span><span>{fmt(monthlyEmi)}</span>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", marginTop:5, background:"#ffebee", fontWeight:700}}>
            <span>TOTAL EXPENSES</span><span style={{color:"#c62828"}}>{fmt(totalExpenses)}</span>
          </div>
        </Card>
        
        <Card>
          <div style={{fontWeight:700, marginBottom:12}}>📋 Trip History</div>
          {filteredTrips.length === 0 ? (
            <EmptyState text="No trips for this period" />
          ) : (
            <div style={{maxHeight:300, overflowY:"auto"}}>
              {filteredTrips.map(trip => (
                <div key={trip.id} style={{padding:"8px 0", borderBottom:"1px solid #f0f0f0"}}>
                  <div style={{display:"flex", justifyContent:"space-between"}}>
                    <span style={{fontWeight:500}}>{trip.date}</span>
                    <span style={{color:"#2e7d32"}}>{fmt(trip.freight)}</span>
                  </div>
                  <div style={{fontSize:11, color:"#666"}}>{trip.from} → {trip.to} · {trip.partyName}</div>
                  <div style={{fontSize:11, color: (trip.netProfit || 0) >= 0 ? "#2e7d32" : "#c62828"}}>
                    Profit: {fmt(trip.netProfit)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      
      <div style={{display:"flex", justifyContent:"flex-end", marginTop:16}}>
        <Btn onClick={onClose}>Close</Btn>
      </div>
    </div>
  );
}
function TrucksPage({ data, update }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [truckMonths, setTruckMonths] = useState({}); // Store selected month per truck
  
  const blank = {
    number:"",ownership:"own",fuelType:"diesel",driver:"",helper:"",status:"available",
    insuranceExpiry:"",fitnessExpiry:"",permitExpiry:"",pollutionExpiry:"",taxExpiry:"",
    rcDetails:"",notes:"",emiAmount:0,emiStartDate:"",emiEndDate:"",loanAmount:0,
    insuranceAmount:0,permitAmount:0,taxAmount:0,fitnessAmount:0
  };
  const [f, setF] = useState(blank);

  const save = () => {
    if (!f.number) return alert("Truck number required");
    const list = [...data.trucks];
    if (editing) {
      const idx = list.findIndex(t=>t.id===editing.id);
      list[idx] = { ...editing, ...f };
    } else {
      list.push({ ...f, id: genId() });
    }
    update("trucks", list);
    setShowForm(false);
    setEditing(null);
    setF(blank);
  };

  const del = (id) => {
    if (!confirm("Delete truck?")) return;
    update("trucks", data.trucks.filter(t=>t.id!==id));
  };

  const docStatus = (date) => {
    if (!date) return null;
    const today = new Date().toISOString().slice(0,10);
    const soon = new Date(Date.now()+30*864e5).toISOString().slice(0,10);
    if (date < today) return "red";
    if (date <= soon) return "yellow";
    return "green";
  };

  const statusColors = {available:"green",on_trip:"blue",repair:"orange",inactive:"gray"};

  // Calculate complete truck P&L for a specific month
  const getTruckCompletePL = (truckNumber, targetMonth) => {
    // Get trips for the selected month ONLY
    const allTrips = data.trips.filter(t => t.truckNumber === truckNumber);
    const filteredTrips = allTrips.filter(t => tripMonth(t) === targetMonth);
    
    const tripIncome = filteredTrips.reduce((s, t) => s + (Number(t.freight) || 0), 0);
    const tripExpenses = {
      diesel: filteredTrips.reduce((s, t) => s + (Number(t.diesel) || 0), 0),
      cng: filteredTrips.reduce((s, t) => s + (Number(t.cng) || 0), 0),
      toll: filteredTrips.reduce((s, t) => s + (Number(t.toll) || 0), 0),
      driverAdvance: filteredTrips.reduce((s, t) => s + (Number(t.driverAdvance) || 0), 0),
      otherExpense: filteredTrips.reduce((s, t) => s + (Number(t.otherExpense) || 0), 0),
    };
    const totalTripExpenses = Object.values(tripExpenses).reduce((a, b) => a + b, 0);
    
    // General expenses for this specific truck for the selected month
    const generalExpenses = (data.generalExpenses || []).filter(e => 
      e.vehicleNumber === truckNumber && e.date?.slice(0,7) === targetMonth
    );
    const totalGeneralExpenses = generalExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    
    // Staff salary for driver for the selected month
    const truckDriver = data.drivers.find(d => d.truck === truckNumber);
    const driverSalaries = (data.staffSalaries || []).filter(s => 
      s.staffName === truckDriver?.name && s.salaryMonth === targetMonth
    );
    const totalDriverSalary = driverSalaries.reduce((s, sal) => s + (Number(sal.netAmount) || 0), 0);
    
    const truckData = data.trucks.find(t => t.number === truckNumber);
    
    // EMI - monthly
    const monthlyEmi = Number(truckData?.emiAmount) || 0;
    
    // Annual costs - divide by 12, but only if document is valid
    const getMonthlyCost = (expiryDate, annualAmount) => {
      if (!expiryDate || !annualAmount || annualAmount <= 0) return 0;
      const expiry = new Date(expiryDate);
      const current = new Date(targetMonth + "-01");
      if (expiry < current) return 0;
      return Number(annualAmount) / 12;
    };
    
    const monthlyInsurance = getMonthlyCost(truckData?.insuranceExpiry, truckData?.insuranceAmount);
    const monthlyPermit = getMonthlyCost(truckData?.permitExpiry, truckData?.permitAmount);
    const monthlyTax = getMonthlyCost(truckData?.taxExpiry, truckData?.taxAmount);
    const monthlyFitness = getMonthlyCost(truckData?.fitnessExpiry, truckData?.fitnessAmount);
    
    const totalMonthlyFixedExpenses = monthlyEmi + monthlyInsurance + monthlyPermit + monthlyTax + monthlyFitness;
    const totalExpenses = totalTripExpenses + totalGeneralExpenses + totalDriverSalary + totalMonthlyFixedExpenses;
    const netProfit = tripIncome - totalExpenses;
    
    return {
      tripIncome,
      tripExpenses: totalTripExpenses,
      generalExpenses: totalGeneralExpenses,
      driverSalary: totalDriverSalary,
      fixedExpenses: totalMonthlyFixedExpenses,
      totalExpenses,
      netProfit,
      trips: filteredTrips.length,
      emiAmount: monthlyEmi,
      breakdownDetails: {
        diesel: tripExpenses.diesel,
        cng: tripExpenses.cng,
        toll: tripExpenses.toll,
        other: tripExpenses.otherExpense
      }
    };
  };

  // Get or set truck month
  const getTruckMonth = (truckId) => truckMonths[truckId] || currentMonth;
  const setTruckMonth = (truckId, month) => {
    setTruckMonths(prev => ({ ...prev, [truckId]: month }));
  };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:"#1a1a2e"}}>Trucks</h2>
        <Btn onClick={()=>{setF(blank);setEditing(null);setShowForm(true)}}>+ Add Truck</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(400px,1fr))",gap:16}}>
        {data.trucks.length===0 && <EmptyState text="No trucks added yet" />}
        {data.trucks.map(t => {
          const truckMonth = getTruckMonth(t.id);
          const pl = getTruckCompletePL(t.number, truckMonth);
          
          return (
            <Card key={t.id}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                <div>
                  <div 
                    style={{fontWeight:700,fontSize:18,color:"#1a1a2e",cursor:"pointer",textDecoration:"underline"}} 
                    onClick={() => setSelectedTruck(t)}
                  >
                    {t.number} 📋
                  </div>
                  <div style={{color:"#888",fontSize:13}}>{t.ownership} · {t.fuelType}</div>
                  {t.driver && <div style={{fontSize:13}}>Driver: {t.driver}</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                  <Badge color={statusColors[t.status]||"gray"}>{t.status?.replace("_"," ")}</Badge>
                  <div style={{display:"flex",gap:6}}>
                    <Btn small outline onClick={()=>{setEditing(t);setF(t);setShowForm(true)}}>Edit</Btn>
                    <Btn small danger onClick={()=>del(t.id)}>Del</Btn>
                  </div>
                </div>
              </div>
              
              {/* Month Selector and Performance */}
              <div style={{background:"#f5f5f5",borderRadius:8,padding:"10px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontWeight:600,fontSize:12,color:"#555"}}>📊 Performance</span>
                  <select 
                    value={truckMonth} 
                    onChange={(e) => setTruckMonth(t.id, e.target.value)}
                    style={{...inp, width:120, padding:"4px 8px", fontSize:12}}
                  >
                    {monthOptions().slice(0,6).map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                  </select>
                </div>
                
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:12,color:"#666"}}>Trips this month</span>
                  <span style={{fontWeight:600}}>{pl.trips}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:12,color:"#666"}}>Income (Freight)</span>
                  <span style={{fontWeight:600,color:"#2e7d32"}}>{fmt(pl.tripIncome)}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:12,color:"#666"}}>Trip Expenses</span>
                  <span style={{fontWeight:600,color:"#c62828"}}>{fmt(pl.tripExpenses)}</span>
                </div>
                {pl.generalExpenses > 0 && (
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:12,color:"#666"}}>General Expenses</span>
                    <span style={{fontWeight:600,color:"#c62828"}}>{fmt(pl.generalExpenses)}</span>
                  </div>
                )}
                {pl.driverSalary > 0 && (
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:12,color:"#666"}}>Driver Salary</span>
                    <span style={{fontWeight:600,color:"#c62828"}}>{fmt(pl.driverSalary)}</span>
                  </div>
                )}
                {pl.emiAmount > 0 && (
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:12,color:"#666"}}>Monthly EMI</span>
                    <span style={{fontWeight:600,color:"#c62828"}}>{fmt(pl.emiAmount)}</span>
                  </div>
                )}
                {pl.fixedExpenses > 0 && pl.fixedExpenses !== pl.emiAmount && (
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:12,color:"#666"}}>Other Fixed Costs</span>
                    <span style={{fontWeight:600,color:"#c62828"}}>{fmt(pl.fixedExpenses - pl.emiAmount)}</span>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"2px solid #ddd"}}>
                  <span style={{fontSize:13,fontWeight:700}}>Net Profit/Loss</span>
                  <span style={{fontWeight:700,fontSize:14,color:pl.netProfit>=0?"#2e7d32":"#c62828"}}>{fmt(pl.netProfit)}</span>
                </div>
              </div>
              
              {/* Document expiry display */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}}>
                {[
                  ["Insurance",t.insuranceExpiry, t.insuranceAmount],
                  ["Fitness",t.fitnessExpiry, t.fitnessAmount],
                  ["Permit",t.permitExpiry, t.permitAmount],
                  ["Pollution",t.pollutionExpiry],
                  ["Tax",t.taxExpiry, t.taxAmount]
                ].map(([l,d,amt]) => d && (
                  <div key={l} style={{
                    display:"flex",justifyContent:"space-between",padding:"4px 8px",borderRadius:6,
                    background:docStatus(d)==="red"?"#ffebee":docStatus(d)==="yellow"?"#fffde7":"#e8f5e9"
                  }}>
                    <span style={{color:"#555"}}>{l}</span>
                    <span style={{
                      fontWeight:600,
                      color:docStatus(d)==="red"?"#c62828":docStatus(d)==="yellow"?"#f57f17":"#2e7d32"
                    }}>
                      {d}
                    </span>
                  </div>
                ))}
              </div>
              {t.emiAmount > 0 && (
                <div style={{marginTop:8,fontSize:11,color:"#888"}}>
                  💰 EMI: {fmt(t.emiAmount)}/month
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Truck Detail Modal */}
      <Modal open={!!selectedTruck} onClose={()=>setSelectedTruck(null)} title={`Truck Details: ${selectedTruck?.number}`} wide>
        {selectedTruck && <TruckDetailModal truck={selectedTruck} data={data} onClose={()=>setSelectedTruck(null)} />}
      </Modal>

      {/* Add/Edit Truck Modal */}
      <Modal open={showForm} onClose={()=>{setShowForm(false);setEditing(null)}} title={editing?"Edit Truck":"New Truck"} wide>
        <div style={{display:"flex",flexWrap:"wrap",gap:0}}>
          <Input label="Truck Number" value={f.number} onChange={e=>setF(p=>({...p,number:e.target.value}))} half />
          <Select label="Ownership" value={f.ownership} onChange={e=>setF(p=>({...p,ownership:e.target.value}))} half>
            <option value="own">Own</option><option value="market">Market</option><option value="attached">Attached</option>
          </Select>
          <Select label="Fuel Type" value={f.fuelType} onChange={e=>setF(p=>({...p,fuelType:e.target.value}))} half>
            <option value="diesel">Diesel</option><option value="cng">CNG</option>
          </Select>
          <Select label="Status" value={f.status} onChange={e=>setF(p=>({...p,status:e.target.value}))} half>
            <option value="available">Available</option><option value="on_trip">On Trip</option>
            <option value="repair">Repair</option><option value="inactive">Inactive</option>
          </Select>
          <Input label="Driver Assigned" value={f.driver} onChange={e=>setF(p=>({...p,driver:e.target.value}))} half />
          <Input label="Helper" value={f.helper} onChange={e=>setF(p=>({...p,helper:e.target.value}))} half />
        </div>
        
        <div style={{fontWeight:600,fontSize:13,color:"#666",margin:"12px 0 8px",textTransform:"uppercase"}}>Loan / EMI Details</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:0}}>
          <Input label="Monthly EMI (₹)" type="number" value={f.emiAmount} onChange={e=>setF(p=>({...p,emiAmount:e.target.value}))} half />
          <Input label="Loan Amount (₹)" type="number" value={f.loanAmount} onChange={e=>setF(p=>({...p,loanAmount:e.target.value}))} half />
          <Input label="EMI Start Date" type="date" value={f.emiStartDate} onChange={e=>setF(p=>({...p,emiStartDate:e.target.value}))} half />
          <Input label="EMI End Date" type="date" value={f.emiEndDate} onChange={e=>setF(p=>({...p,emiEndDate:e.target.value}))} half />
        </div>
        
        <div style={{fontWeight:600,fontSize:13,color:"#666",margin:"12px 0 8px",textTransform:"uppercase"}}>Document Expiry Dates & Annual Amounts</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:0}}>
          <Input label="Insurance Expiry" type="date" value={f.insuranceExpiry} onChange={e=>setF(p=>({...p,insuranceExpiry:e.target.value}))} half />
          <Input label="Insurance Amount (₹/year)" type="number" value={f.insuranceAmount} onChange={e=>setF(p=>({...p,insuranceAmount:e.target.value}))} half />
          <Input label="Fitness Expiry" type="date" value={f.fitnessExpiry} onChange={e=>setF(p=>({...p,fitnessExpiry:e.target.value}))} half />
          <Input label="Fitness Amount (₹/year)" type="number" value={f.fitnessAmount} onChange={e=>setF(p=>({...p,fitnessAmount:e.target.value}))} half />
          <Input label="Permit Expiry" type="date" value={f.permitExpiry} onChange={e=>setF(p=>({...p,permitExpiry:e.target.value}))} half />
          <Input label="Permit Amount (₹/year)" type="number" value={f.permitAmount} onChange={e=>setF(p=>({...p,permitAmount:e.target.value}))} half />
          <Input label="Tax Expiry" type="date" value={f.taxExpiry} onChange={e=>setF(p=>({...p,taxExpiry:e.target.value}))} half />
          <Input label="Tax Amount (₹/year)" type="number" value={f.taxAmount} onChange={e=>setF(p=>({...p,taxAmount:e.target.value}))} half />
          <Input label="Pollution Expiry" type="date" value={f.pollutionExpiry} onChange={e=>setF(p=>({...p,pollutionExpiry:e.target.value}))} half />
          <Input label="RC Details" value={f.rcDetails} onChange={e=>setF(p=>({...p,rcDetails:e.target.value}))} half />
        </div>
        <Textarea label="Notes" value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} />
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Btn outline onClick={()=>setShowForm(false)}>Cancel</Btn>
          <Btn onClick={save}>Save Truck</Btn>
        </div>
      </Modal>
    </div>
  );
}
function DriverLedger({ driver, data, update, onClose }) {
  const [tab, setTab] = useState("attendance");
  const [attMonth, setAttMonth] = useState(currentMonth);
  const [advMonth, setAdvMonth] = useState(currentMonth); // New: month filter for advances
  const [advForm, setAdvForm] = useState(false);
  const [advF, setAdvF] = useState({ date: new Date().toISOString().slice(0,10), amount:0, note:"", type:"advance" });

  // Attendance helpers
  const attKey = (driverId, month) => `att_${driverId}_${month}`;
  const getAtt = () => {
    try { return JSON.parse(localStorage.getItem(attKey(driver.id, attMonth))||"{}"); } catch { return {}; }
  };
  const saveAtt = (att) => localStorage.setItem(attKey(driver.id, attMonth), JSON.stringify(att));

  const [att, setAtt] = useState(getAtt);
  useEffect(()=>setAtt(getAtt()),[attMonth]);

  const markAtt = (day, status) => {
    const newAtt = {...att, [day]: status};
    setAtt(newAtt);
    saveAtt(newAtt);
  };

  // Days in selected month
  const [yr, mo] = attMonth.split("-").map(Number);
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const days = Array.from({length: daysInMonth}, (_, i) => String(i+1).padStart(2,"0"));

  const statusColors = { P:{bg:"#e8f5e9",c:"#2e7d32",label:"P"}, A:{bg:"#ffebee",c:"#c62828",label:"A"},
    H:{bg:"#fff3e0",c:"#e65100",label:"H"}, L:{bg:"#e3f2fd",c:"#1565c0",label:"L"} };

  const present = days.filter(d=>att[d]==="P").length;
  const absent = days.filter(d=>att[d]==="A").length;
  const half = days.filter(d=>att[d]==="H").length;
  const leave = days.filter(d=>att[d]==="L").length;
  const effectiveDays = present + (half*0.5);

  // Salary calc
  const totalDays = daysInMonth;
  const salaryEarned = driver.salaryType==="monthly"
    ? Math.round((Number(driver.salary)||0) * effectiveDays / totalDays)
    : driver.salaryType==="per_day"
    ? Math.round((Number(driver.salary)||0) * effectiveDays)
    : Number(driver.salary)||0;

  // Advances with month filter
  const allAdvances = (data.driverAdvances||[]).filter(a=>a.driverId===driver.id);
  const advances = allAdvances.filter(a => a.date?.slice(0,7) === advMonth)
    .sort((a,b)=>b.date?.localeCompare(a.date));
  
  const tripAdvancesAll = data.trips.filter(t=>t.driverName===driver.name&&(Number(t.driverAdvance)||0)>0);
  const tripAdvances = tripAdvancesAll.filter(t => t.date?.slice(0,7) === advMonth);
  
  // Totals for selected month
  const totalAdvGiven = advances.filter(a=>a.type==="advance").reduce((s,a)=>s+(Number(a.amount)||0),0)
    + tripAdvances.reduce((s,t)=>s+(Number(t.driverAdvance)||0),0);
  const totalSalaryPaid = advances.filter(a=>a.type==="salary").reduce((s,a)=>s+(Number(a.amount)||0),0);
  const advanceOutstanding = Math.max(0, totalAdvGiven - totalSalaryPaid);

  // Cumulative totals (all time)
  const allTimeAdvGiven = allAdvances.filter(a=>a.type==="advance").reduce((s,a)=>s+(Number(a.amount)||0),0)
    + tripAdvancesAll.reduce((s,t)=>s+(Number(t.driverAdvance)||0),0);
  const allTimeSalaryPaid = allAdvances.filter(a=>a.type==="salary").reduce((s,a)=>s+(Number(a.amount)||0),0);
  const cumulativeOutstanding = Math.max(0, allTimeAdvGiven - allTimeSalaryPaid);

  const saveAdv = () => {
    if (!advF.amount) return alert("Amount required");
    const list = [...(data.driverAdvances||[]), { ...advF, driverId: driver.id, id: genId() }];
    update("driverAdvances", list);
    setAdvForm(false);
    setAdvF({ date: new Date().toISOString().slice(0,10), amount:0, note:"", type:"advance" });
  };

  const delAdv = (id) => {
    if (!confirm("Delete entry?")) return;
    update("driverAdvances", (data.driverAdvances||[]).filter(a=>a.id!==id));
  };

  const tabStyle = (t) => ({
    padding:"9px 20px", border:"none", cursor:"pointer", fontWeight:600, fontSize:13,
    borderBottom: tab===t ? "3px solid #1a1a2e" : "3px solid transparent",
    background:"none", color: tab===t ? "#1a1a2e" : "#888"
  });

  return (
    <div>
      {/* Driver summary */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        <StatCard label="Salary/Month" value={fmt(driver.salary)} color="blue" />
        <StatCard label="Total Advance (This Month)" value={fmt(totalAdvGiven)} color="orange" />
        <StatCard label="Salary Paid (This Month)" value={fmt(totalSalaryPaid)} color="green" />
        <StatCard label={advanceOutstanding>0?"Advance to Recover":"Account Settled"} value={advanceOutstanding>0?fmt(advanceOutstanding):"✓ Clear"} color={advanceOutstanding>0?"orange":"green"} />
      </div>
      
      {/* Cumulative Info */}
      <div style={{background:"#f0f4ff",borderRadius:8,padding:"8px 12px",marginBottom:16,fontSize:12}}>
        <span style={{color:"#666"}}>📊 Cumulative Outstanding: </span>
        <span style={{fontWeight:700,color:cumulativeOutstanding>0?"#e65100":"#2e7d32"}}>
          {cumulativeOutstanding>0?fmt(cumulativeOutstanding):"Settled"}
        </span>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:"1px solid #eee",marginBottom:20}}>
        <button style={tabStyle("attendance")} onClick={()=>setTab("attendance")}>📅 Attendance</button>
        <button style={tabStyle("advances")} onClick={()=>setTab("advances")}>💰 Advances & Salary</button>
      </div>

      {/* ATTENDANCE TAB - same as before */}
      {tab==="attendance" && (
        <div>
          {/* ... keep existing attendance code ... */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <select value={attMonth} onChange={e=>setAttMonth(e.target.value)} style={{...inp,width:160}}>
              {monthOptions().map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
            <div style={{display:"flex",gap:10,fontSize:13}}>
              {[["P","Present","green"],["A","Absent","red"],["H","Half Day","orange"],["L","Leave","blue"]].map(([k,l,c])=>(
                <div key={k} style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:20,height:20,borderRadius:4,background:statusColors[k].bg,
                    border:`1px solid ${statusColors[k].c}`,display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:11,fontWeight:700,color:statusColors[k].c}}>{k}</div>
                  <span style={{color:"#666"}}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
            {[["Present",present,"green"],["Absent",absent,"red"],["Half Day",half,"orange"],
              ["Leave",leave,"blue"],["Earned Days",effectiveDays,"purple"]
            ].map(([l,v,c])=>(
              <StatCard key={l} label={l} value={v} color={c} />
            ))}
          </div>

          <div style={{background:"#e8f5e9",borderRadius:8,padding:"12px 16px",marginBottom:16,
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,color:"#2e7d32",fontWeight:600}}>ESTIMATED SALARY FOR {getMonthLabel(attMonth)}</div>
              <div style={{fontSize:11,color:"#555",marginTop:2}}>
                {driver.salaryType==="monthly"
                  ? `${fmt(driver.salary)} × ${effectiveDays}/${totalDays} days`
                  : `${fmt(driver.salary)}/day × ${effectiveDays} days`}
              </div>
            </div>
            <div style={{fontSize:22,fontWeight:700,color:"#2e7d32"}}>{fmt(salaryEarned)}</div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(
              <div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:"#888",padding:"4px 0"}}>{d}</div>
            ))}
            {Array.from({length: new Date(yr, mo-1, 1).getDay()}, (_,i)=>(
              <div key={"e"+i} />
            ))}
            {days.map(day=>{
              const status = att[day];
              const s = statusColors[status];
              return (
                <div key={day} style={{textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#aaa",marginBottom:3}}>{parseInt(day)}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2}}>
                    {["P","A","H","L"].map(st=>(
                      <div key={st} onClick={()=>markAtt(day, status===st ? undefined : st)}
                        style={{
                          padding:"3px 0",borderRadius:4,cursor:"pointer",fontSize:10,fontWeight:700,
                          textAlign:"center",
                          background: status===st ? statusColors[st].bg : "#f5f5f5",
                          color: status===st ? statusColors[st].c : "#bbb",
                          border: status===st ? `1px solid ${statusColors[st].c}` : "1px solid #eee"
                        }}>{st}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ADVANCES TAB - with month filter */}
      {tab==="advances" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{fontWeight:700,fontSize:15}}>Advance & Salary History</div>
              <select value={advMonth} onChange={e=>setAdvMonth(e.target.value)} style={{...inp,width:140,padding:"6px 10px"}}>
                {monthOptions().map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
              </select>
            </div>
            <Btn onClick={()=>setAdvForm(true)}>+ Add Entry</Btn>
          </div>

          {/* Trip advances for selected month */}
          {tripAdvances.length>0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"#888",textTransform:"uppercase",marginBottom:8}}>
                Advances from Trips ({getMonthLabel(advMonth)})
              </div>
              {tripAdvances.map(t=>(
                <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"9px 0",borderBottom:"1px solid #f0f0f0"}}>
                  <div>
                    <div style={{fontWeight:500,fontSize:13}}>{t.date} · Trip Advance</div>
                    <div style={{fontSize:12,color:"#888"}}>{t.truckNumber} · {t.from}→{t.to}</div>
                  </div>
                  <Badge color="orange">{fmt(t.driverAdvance)}</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Manual entries for selected month */}
          <div style={{fontSize:12,fontWeight:700,color:"#888",textTransform:"uppercase",marginBottom:8}}>
            Manual Entries ({getMonthLabel(advMonth)})
          </div>
          {advances.length===0 && tripAdvances.length===0 && <EmptyState text="No entries for this month" />}
          {advances.map(a=>(
            <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"10px 0",borderBottom:"1px solid #f0f0f0"}}>
              <div>
                <div style={{fontWeight:500,fontSize:13}}>
                  {a.date} · <span style={{color:a.type==="advance"?"#e65100":"#2e7d32"}}>
                    {a.type==="advance"?"Advance Given":"Salary Paid"}
                  </span>
                </div>
                {a.note&&<div style={{fontSize:12,color:"#888"}}>{a.note}</div>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Badge color={a.type==="advance"?"orange":"green"}>{fmt(a.amount)}</Badge>
                <Btn small danger onClick={()=>delAdv(a.id)}>Del</Btn>
              </div>
            </div>
          ))}

          <div style={{marginTop:16,padding:"12px 16px",borderRadius:8,
            background:advanceOutstanding>0?"#fff3e0":"#e8f5e9",display:"flex",justifyContent:"space-between"}}>
            <span style={{fontWeight:700}}>{advanceOutstanding>0?"Advance Outstanding for this month":"✓ Account Settled for this month"}</span>
            <span style={{fontWeight:700,fontSize:16,color:advanceOutstanding>0?"#e65100":"#2e7d32"}}>{fmt(advanceOutstanding)}</span>
          </div>

          <Modal open={advForm} onClose={()=>setAdvForm(false)} title="Add Advance / Salary Entry">
            <Input label="Date" type="date" value={advF.date} onChange={e=>setAdvF(p=>({...p,date:e.target.value}))} half />
            <Select label="Type" value={advF.type} onChange={e=>setAdvF(p=>({...p,type:e.target.value}))} half>
              <option value="advance">Advance Given</option>
              <option value="salary">Salary Paid</option>
            </Select>
            <Input label="Amount (₹)" type="number" value={advF.amount} onChange={e=>setAdvF(p=>({...p,amount:e.target.value}))} half />
            <Input label="Note" value={advF.note} onChange={e=>setAdvF(p=>({...p,note:e.target.value}))} half />
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
              <Btn outline onClick={()=>setAdvForm(false)}>Cancel</Btn>
              <Btn onClick={saveAdv}>Save</Btn>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
}

function DriversPage({ data, update }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewDriver, setViewDriver] = useState(null);
  const blank = {
    name:"",mobile:"",address:"",truck:"",salaryType:"monthly",salary:0,
    joining:"",status:"active",remarks:""
  };
  const [f, setF] = useState(blank);

  const save = () => {
    if (!f.name) return alert("Driver name required");
    const list = [...data.drivers];
    if (editing) {
      const idx = list.findIndex(d=>d.id===editing.id);
      list[idx] = { ...editing, ...f };
    } else {
      list.push({ ...f, id: genId() });
    }
    update("drivers", list);
    setShowForm(false);
    setEditing(null);
    setF(blank);
  };

  const del = (id) => {
    if (!confirm("Delete driver?")) return;
    update("drivers", data.drivers.filter(d=>d.id!==id));
  };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:"#1a1a2e"}}>Drivers</h2>
        <Btn onClick={()=>{setF(blank);setEditing(null);setShowForm(true)}}>+ Add Driver</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
        {data.drivers.length===0&&<EmptyState text="No drivers added yet" />}
        {data.drivers.map(d=>{
          const trips = data.trips.filter(t=>t.driverName===d.name);
          const tripAdvances = trips.reduce((s,t)=>s+(Number(t.driverAdvance)||0),0);
          const manualAdvances = (data.driverAdvances||[]).filter(a=>a.driverId===d.id);
          const totalAdv = tripAdvances + manualAdvances.filter(a=>a.type==="advance").reduce((s,a)=>s+(Number(a.amount)||0),0);
          const salaryPaid = manualAdvances.filter(a=>a.type==="salary").reduce((s,a)=>s+(Number(a.amount)||0),0);
          const advOutstanding = Math.max(0, totalAdv - salaryPaid);
          const isSettled = advOutstanding === 0;
          return (
            <Card key={d.id}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <div>
                  <div style={{fontWeight:700,fontSize:16}}>{d.name}</div>
                  <div style={{color:"#888",fontSize:13}}>{d.mobile}</div>
                  {d.truck&&<div style={{fontSize:13}}>Truck: {d.truck}</div>}
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  <Btn small outline onClick={()=>{setEditing(d);setF(d);setShowForm(true)}}>Edit</Btn>
                  <Btn small danger onClick={()=>del(d.id)}>Del</Btn>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                <div style={{background:"#e3f2fd",borderRadius:8,padding:"8px",textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#1565c0",fontWeight:600}}>SALARY</div>
                  <div style={{fontWeight:700,color:"#1565c0",fontSize:14}}>{fmt(d.salary)}/{d.salaryType==="monthly"?"mo":d.salaryType==="per_day"?"day":"trip"}</div>
                </div>
                <div style={{background:advOutstanding>0?"#fff3e0":"#e8f5e9",borderRadius:8,padding:"8px",textAlign:"center"}}>
                  <div style={{fontSize:11,color:advOutstanding>0?"#e65100":"#2e7d32",fontWeight:600}}>ADVANCE OUTSTANDING</div>
                  <div style={{fontWeight:700,color:advOutstanding>0?"#e65100":"#2e7d32",fontSize:14}}>{advOutstanding===0?"✓ Settled":fmt(advOutstanding)}</div>
                </div>
              </div>
              <div style={{fontSize:13,color:"#555",marginBottom:10}}>
                <div>Trips: {trips.length} · Total Advance: {fmt(totalAdv)}</div>
                <div>Joined: {d.joining||"-"}</div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <Badge color={d.status==="active"?"green":"gray"}>{d.status}</Badge>
                <Btn small onClick={()=>setViewDriver(d)} color="#1565c0">Attendance & Ledger →</Btn>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add/Edit Driver Modal */}
      <Modal open={showForm} onClose={()=>{setShowForm(false);setEditing(null)}} title={editing?"Edit Driver":"New Driver"}>
        <Input label="Driver Name" value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} />
        <Input label="Mobile" value={f.mobile} onChange={e=>setF(p=>({...p,mobile:e.target.value}))} half />
        <Input label="Assigned Truck" value={f.truck} onChange={e=>setF(p=>({...p,truck:e.target.value}))} half />
        <Select label="Salary Type" value={f.salaryType} onChange={e=>setF(p=>({...p,salaryType:e.target.value}))} half>
          <option value="monthly">Monthly</option>
          <option value="per_trip">Per Trip</option>
          <option value="per_day">Per Day</option>
        </Select>
        <Input label="Salary Amount (₹)" type="number" value={f.salary} onChange={e=>setF(p=>({...p,salary:e.target.value}))} half />
        <Input label="Joining Date" type="date" value={f.joining} onChange={e=>setF(p=>({...p,joining:e.target.value}))} half />
        <Select label="Status" value={f.status} onChange={e=>setF(p=>({...p,status:e.target.value}))} half>
          <option value="active">Active</option><option value="inactive">Inactive</option>
        </Select>
        <Textarea label="Address" value={f.address} onChange={e=>setF(p=>({...p,address:e.target.value}))} />
        <Textarea label="Remarks" value={f.remarks} onChange={e=>setF(p=>({...p,remarks:e.target.value}))} />
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Btn outline onClick={()=>setShowForm(false)}>Cancel</Btn>
          <Btn onClick={save}>Save Driver</Btn>
        </div>
      </Modal>

      {/* Driver Ledger Modal */}
      <Modal open={!!viewDriver} onClose={()=>setViewDriver(null)}
        title={viewDriver?`${viewDriver.name} — Attendance & Ledger`:""} wide>
        {viewDriver&&<DriverLedger driver={viewDriver} data={data} update={update} onClose={()=>setViewDriver(null)} />}
      </Modal>
    </div>
  );
}

function CashbookPage({ data, update, openAdd }) {
  const [month, setMonth] = useState(currentMonth);
  const [showForm, setShowForm] = useState(openAdd||false);
  const [editing, setEditing] = useState(null);
  const blank = {
    date: new Date().toISOString().slice(0,10),
    type:"in",category:"",particulars:"",related:"",amount:0,mode:"cash",remarks:""
  };
  const [f, setF] = useState(blank);
  useEffect(()=>{if(openAdd)setShowForm(true);},[openAdd]);

  const entries = data.cashbook.filter(c=>c.date?.slice(0,7)===month)
    .sort((a,b)=>a.date?.localeCompare(b.date));

  const cashIn = entries.filter(e=>e.type==="in").reduce((s,e)=>s+(Number(e.amount)||0),0);
  const cashOut = entries.filter(e=>e.type==="out").reduce((s,e)=>s+(Number(e.amount)||0),0);

  const save = () => {
    const list = [...data.cashbook];
    if (editing) {
      const idx = list.findIndex(e=>e.id===editing.id);
      list[idx] = { ...editing, ...f };
    } else {
      list.push({ ...f, id: genId() });
    }
    update("cashbook", list);
    setShowForm(false);
    setEditing(null);
    setF(blank);
  };

  const del = (id) => {
    if (!confirm("Delete entry?")) return;
    update("cashbook", data.cashbook.filter(e=>e.id!==id));
  };

  const cats = ["Diesel","CNG","Toll","Driver Advance","Salary","Repair","Office Expense","Fastag","Freight Received","Miscellaneous"];

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:"#1a1a2e"}}>Cash Book</h2>
        <div style={{display:"flex",gap:10}}>
          <select value={month} onChange={e=>setMonth(e.target.value)} style={{...inp,width:160}}>
            {monthOptions().map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <Btn onClick={()=>{setF(blank);setEditing(null);setShowForm(true)}}>+ Add Entry</Btn>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        <StatCard label="Money In" value={fmt(cashIn)} color="green" />
        <StatCard label="Money Out" value={fmt(cashOut)} color="red" />
        <StatCard label="Net Balance" value={fmt(cashIn-cashOut)} color={cashIn-cashOut>=0?"teal":"orange"} />
        <StatCard label="Entries" value={entries.length} color="blue" />
      </div>

      <Card style={{overflowX:"auto"}}>
        {entries.length===0 ? <EmptyState text="No cash entries for this month" /> : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#f8f8f8",borderBottom:"2px solid #eee"}}>
              {["Date","Type","Category","Particulars","Related","Amount","Mode",""].map(h=>(
                <th key={h} style={{textAlign:h==="Amount"?"right":"left",
                  padding:"10px 12px",color:"#666",fontWeight:700,fontSize:12,textTransform:"uppercase"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {entries.map(e=>(
                <tr key={e.id} style={{borderBottom:"1px solid #f0f0f0"}}>
                  <td style={{padding:"10px 12px"}}>{e.date}</td>
                  <td style={{padding:"10px 12px"}}>
                    <Badge color={e.type==="in"?"green":"red"}>{e.type==="in"?"Money In":"Money Out"}</Badge>
                  </td>
                  <td style={{padding:"10px 12px"}}>{e.category}</td>
                  <td style={{padding:"10px 12px"}}>{e.particulars}</td>
                  <td style={{padding:"10px 12px",color:"#666"}}>{e.related}</td>
                  <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,
                    color:e.type==="in"?"#2e7d32":"#c62828"}}>{fmt(e.amount)}</td>
                  <td style={{padding:"10px 12px",color:"#666"}}>{e.mode}</td>
                  <td style={{padding:"10px 12px"}}>
                    <Btn small outline onClick={()=>{setEditing(e);setF(e);setShowForm(true)}}>Edit</Btn>
                    {" "}
                    <Btn small danger onClick={()=>del(e.id)}>Del</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={showForm} onClose={()=>{setShowForm(false);setEditing(null)}} title={editing?"Edit Entry":"New Cash Entry"}>
        <Input label="Date" type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))} half />
        <Select label="Type" value={f.type} onChange={e=>setF(p=>({...p,type:e.target.value}))} half>
          <option value="in">Money In</option>
          <option value="out">Money Out</option>
        </Select>
        <Select label="Category" value={f.category} onChange={e=>setF(p=>({...p,category:e.target.value}))} half>
          <option value="">Select</option>
          {cats.map(c=><option key={c} value={c}>{c}</option>)}
        </Select>
        <Input label="Mode" value={f.mode} onChange={e=>setF(p=>({...p,mode:e.target.value}))} half />
        <Input label="Particulars" value={f.particulars} onChange={e=>setF(p=>({...p,particulars:e.target.value}))} />
        <Input label="Related (Party/Truck/Driver)" value={f.related} onChange={e=>setF(p=>({...p,related:e.target.value}))} half />
        <Input label="Amount (₹)" type="number" value={f.amount} onChange={e=>setF(p=>({...p,amount:e.target.value}))} half />
        <Textarea label="Remarks" value={f.remarks} onChange={e=>setF(p=>({...p,remarks:e.target.value}))} />
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Btn outline onClick={()=>setShowForm(false)}>Cancel</Btn>
          <Btn onClick={save}>Save Entry</Btn>
        </div>
      </Modal>
    </div>
  );
}

function PaymentsPage({ data, update }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [monthFilter, setMonthFilter] = useState(currentMonth); // New month filter
  const blank = {
    date: new Date().toISOString().slice(0,10),
    partyName:"",amount:0,mode:"cash",reference:"",tripId:"",receivedBy:"",remarks:""
  };
  const [f, setF] = useState(blank);

  const save = () => {
    if (!f.partyName || !f.amount) return alert("Party and amount required");
    const list = [...data.payments];
    const trips = [...data.trips];
    if (editing) {
      const idx = list.findIndex(p=>p.id===editing.id);
      list[idx] = { ...editing, ...f };
    } else {
      list.push({ ...f, id: genId() });
      // Reduce pending on oldest unpaid trip
      const partyTrips = trips.filter(t=>t.partyName===f.partyName&&(Number(t.pending)||0)>0)
        .sort((a,b)=>a.date?.localeCompare(b.date));
      let remaining = Number(f.amount)||0;
      for (const t of partyTrips) {
        if (remaining <= 0) break;
        const reduce = Math.min(remaining, Number(t.pending)||0);
        const idx = trips.findIndex(r=>r.id===t.id);
        trips[idx] = {
          ...t,
          paymentReceived: (Number(t.paymentReceived)||0)+reduce,
          pending: Math.max(0,(Number(t.pending)||0)-reduce),
          paymentStatus: (Number(t.pending)||0)-reduce<=0?"paid":"partial"
        };
        remaining -= reduce;
      }
      update("trips", trips);
    }
    update("payments", list);
    setShowForm(false);
    setEditing(null);
    setF(blank);
  };

  const del = (id) => {
    if (!confirm("Delete payment?")) return;
    update("payments", data.payments.filter(p=>p.id!==id));
  };

  // Apply month filter
  const filteredPayments = data.payments.filter(p => p.date?.slice(0,7) === monthFilter);
  const sorted = [...filteredPayments].sort((a,b)=>b.date?.localeCompare(a.date));
  
  const parties = [...new Set(data.trips.map(t=>t.partyName).filter(Boolean))];
  
  const totalReceived = sorted.reduce((s,p)=>s+(Number(p.amount)||0),0);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:"#1a1a2e"}}>Payments Received</h2>
        <div style={{display:"flex",gap:10}}>
          <select value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} style={{...inp,width:160}}>
            {monthOptions().map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <Btn onClick={()=>{setF(blank);setEditing(null);setShowForm(true)}}>+ Add Payment</Btn>
        </div>
      </div>
      
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        <StatCard label={`Total Received (${getMonthLabel(monthFilter)})`} value={fmt(totalReceived)} color="green" />
        <StatCard label="All Time Total" value={fmt(data.payments.reduce((s,p)=>s+(Number(p.amount)||0),0))} color="blue" />
        <StatCard label="Entries" value={sorted.length} color="purple" />
      </div>
      
      <Card style={{overflowX:"auto"}}>
        {sorted.length===0 ? <EmptyState text={`No payments recorded for ${getMonthLabel(monthFilter)}`} /> : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#f8f8f8",borderBottom:"2px solid #eee"}}>
              {["Date","Party","Amount","Mode","Reference","Received By",""].map(h=>(
                <th key={h} style={{textAlign:h==="Amount"?"right":"left",
                  padding:"10px 12px",color:"#666",fontWeight:700,fontSize:12,textTransform:"uppercase"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{sorted.map(p=>(
              <tr key={p.id} style={{borderBottom:"1px solid #f0f0f0"}}>
                <td style={{padding:"10px 12px"}}>{p.date}</td>
                <td style={{padding:"10px 12px",fontWeight:600}}>{p.partyName}</td>
                <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:"#2e7d32"}}>{fmt(p.amount)}</td>
                <td style={{padding:"10px 12px"}}>{p.mode}</td>
                <td style={{padding:"10px 12px",color:"#888"}}>{p.reference||"-"}</td>
                <td style={{padding:"10px 12px"}}>{p.receivedBy||"-"}</td>
                <td style={{padding:"10px 12px"}}>
                  <Btn small danger onClick={()=>del(p.id)}>Del</Btn>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      
      <Modal open={showForm} onClose={()=>{setShowForm(false);setEditing(null)}} title="New Payment">
        <Input label="Date" type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))} half />
        <Select label="Party Name" value={f.partyName} onChange={e=>setF(p=>({...p,partyName:e.target.value}))} half>
          <option value="">Select Party</option>
          {parties.map(p=><option key={p} value={p}>{p}</option>)}
        </Select>
        <Input label="Amount Received (₹)" type="number" value={f.amount} onChange={e=>setF(p=>({...p,amount:e.target.value}))} half />
        <Select label="Payment Mode" value={f.mode} onChange={e=>setF(p=>({...p,mode:e.target.value}))} half>
          <option value="cash">Cash</option>
          <option value="bank">Bank Transfer</option>
          <option value="cheque">Cheque</option>
          <option value="upi">UPI</option>
        </Select>
        <Input label="Reference Number" value={f.reference} onChange={e=>setF(p=>({...p,reference:e.target.value}))} half />
        <Input label="Received By" value={f.receivedBy} onChange={e=>setF(p=>({...p,receivedBy:e.target.value}))} half />
        <Textarea label="Remarks" value={f.remarks} onChange={e=>setF(p=>({...p,remarks:e.target.value}))} />
        <div style={{padding:"10px 14px",background:"#fff3e0",borderRadius:8,marginBottom:12,fontSize:13}}>
          ⚡ Payment will automatically reduce pending amount for this party's oldest unpaid trips.
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn outline onClick={()=>setShowForm(false)}>Cancel</Btn>
          <Btn onClick={save}>Save Payment</Btn>
        </div>
      </Modal>
    </div>
  );
}

function PendingPage({ data, update }) {
  const [month, setMonth] = useState("");
  const [partyF, setPartyF] = useState("");
  const [daysF, setDaysF] = useState("");
  const [showOpeningForm, setShowOpeningForm] = useState(false);
const [openingForm, setOpeningForm] = useState({
  partyName: "",
  amount: 0,
  remarks: "Before May 2026"
});
  const today = new Date().toISOString().slice(0,10);
  const daysDiff = (date) => {
    if (!date) return 0;
    return Math.floor((Date.now()-new Date(date).getTime())/864e5);
  };

  let pending = data.trips.filter(t=>(Number(t.pending)||0)>0);
  if (month) pending = pending.filter(t=>tripMonth(t)===month);
  if (partyF) pending = pending.filter(t=>t.partyName===partyF);
  if (daysF==="15") pending = pending.filter(t=>daysDiff(t.date)>15);
  if (daysF==="30") pending = pending.filter(t=>daysDiff(t.date)>30);
  pending = pending.sort((a,b)=>(Number(b.pending)||0)-(Number(a.pending)||0));

  const parties = [...new Set(data.trips.filter(t=>(Number(t.pending)||0)>0).map(t=>t.partyName).filter(Boolean))];
  const total = pending.reduce((s,t)=>s+(Number(t.pending)||0),0);

  const openingTotal = (data.openingPending || []).reduce(
  (s, x) => s + (Number(x.amount) || 0),
  0
);

const grandTotal = total + openingTotal;
  const saveOpeningPending = () => {
  if (!openingForm.partyName || !openingForm.amount) {
    return alert("Party and amount required");
  }

  const list = [
    ...(data.openingPending || []),
    {
      ...openingForm,
      id: genId(),
      amount: Number(openingForm.amount),
      createdAt: new Date().toISOString()
    }
  ];

  update("openingPending", list);

  setOpeningForm({
    partyName: "",
    amount: 0,
    remarks: "Before May 2026"
  });

  setShowOpeningForm(false);
};

const deleteOpeningPending = (id) => {
  if (!confirm("Delete opening pending?")) return;
  update(
    "openingPending",
    (data.openingPending || []).filter(x => x.id !== id)
  );
};

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:"#1a1a2e"}}>Pending Payments</h2>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
  <Badge color="orange">Opening Pending: {fmt(openingTotal)}</Badge>
  <Badge color="red">Current Pending: {fmt(total)}</Badge>
  <Badge color="blue">Total Receivable: {fmt(grandTotal)}</Badge>
</div>
      </div>

      <Card style={{marginBottom:16}}>
  <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>
    Opening Pending / Previous Outstanding
  </div>

  {(data.openingPending || []).length === 0 ? (
    <EmptyState text="No opening pending added" />
  ) : (
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
      <thead>
        <tr style={{background:"#f8f8f8",borderBottom:"2px solid #eee"}}>
          <th style={{padding:"10px 12px",textAlign:"left"}}>Party</th>
          <th style={{padding:"10px 12px",textAlign:"right"}}>Amount</th>
          <th style={{padding:"10px 12px",textAlign:"left"}}>Remarks</th>
          <th style={{padding:"10px 12px"}}></th>
        </tr>
      </thead>
      <tbody>
        {(data.openingPending || []).map(x => (
          <tr key={x.id} style={{borderBottom:"1px solid #f0f0f0"}}>
            <td style={{padding:"10px 12px",fontWeight:600}}>{x.partyName}</td>
            <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:"#c62828"}}>
              {fmt(x.amount)}
            </td>
            <td style={{padding:"10px 12px",color:"#666"}}>{x.remarks}</td>
            <td style={{padding:"10px 12px",textAlign:"right"}}>
              <Btn small danger onClick={() => deleteOpeningPending(x.id)}>Del</Btn>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</Card>

      <Card style={{marginBottom:16}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <select value={month} onChange={e=>setMonth(e.target.value)} style={{...inp,width:160}}>
            <option value="">All Months</option>
            {monthOptions().map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <select value={partyF} onChange={e=>setPartyF(e.target.value)} style={{...inp,width:180}}>
            <option value="">All Parties</option>
            {parties.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
          <select value={daysF} onChange={e=>setDaysF(e.target.value)} style={{...inp,width:180}}>
            <option value="">All Days</option>
            <option value="15">More than 15 days</option>
            <option value="30">More than 30 days</option>
          </select>
          <Btn onClick={() => setShowOpeningForm(true)} color="#6a1b9a">
  + Add Opening Pending
</Btn>
        </div>
      </Card>

      <Card style={{overflowX:"auto"}}>
        {pending.length===0 ? <EmptyState text="No pending payments! 🎉" /> : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#f8f8f8",borderBottom:"2px solid #eee"}}>
              {["Party","Mobile","Trip Date","Truck","Freight","Received","Pending","Days Pending"].map(h=>(
                <th key={h} style={{textAlign:h==="Freight"||h==="Received"||h==="Pending"?"right":"left",
                  padding:"10px 12px",color:"#666",fontWeight:700,fontSize:12,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{pending.map(t=>{
              const days = daysDiff(t.date);
              return (
                <tr key={t.id} style={{borderBottom:"1px solid #f0f0f0",
                  background:days>30?"#fff8f8":days>15?"#fffbf0":"#fff"}}>
                  <td style={{padding:"10px 12px",fontWeight:600}}>{t.partyName||"-"}</td>
                  <td style={{padding:"10px 12px"}}>
                    {t.partyMobile&&<a href={`tel:${t.partyMobile}`} style={{color:"#1565c0"}}>{t.partyMobile}</a>}
                  </td>
                  <td style={{padding:"10px 12px"}}>{t.date}</td>
                  <td style={{padding:"10px 12px"}}>{t.truckNumber}</td>
                  <td style={{padding:"10px 12px",textAlign:"right"}}>{fmt(t.freight)}</td>
                  <td style={{padding:"10px 12px",textAlign:"right"}}>{fmt((Number(t.advance)||0)+(Number(t.paymentReceived)||0))}</td>
                  <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:"#c62828"}}>{fmt(t.pending)}</td>
                  <td style={{padding:"10px 12px"}}>
                    <Badge color={days>30?"red":days>15?"orange":"gray"}>{days}d</Badge>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </Card>
      <Modal
  open={showOpeningForm}
  onClose={() => setShowOpeningForm(false)}
  title="Add Opening Pending"
>
  <Input
    label="Party Name"
    value={openingForm.partyName}
    onChange={e=>setOpeningForm(p=>({...p,partyName:e.target.value}))}
    list="opening-party-list"
  />

  <datalist id="opening-party-list">
    {data.parties.map(p => (
      <option key={p.id} value={p.name} />
    ))}
  </datalist>

  <Input
    label="Pending Amount (₹)"
    type="number"
    value={openingForm.amount}
    onChange={e=>setOpeningForm(p=>({...p,amount:e.target.value}))}
  />

  <Textarea
    label="Remarks"
    value={openingForm.remarks}
    onChange={e=>setOpeningForm(p=>({...p,remarks:e.target.value}))}
  />

  <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
    <Btn outline onClick={() => setShowOpeningForm(false)}>Cancel</Btn>
    <Btn onClick={saveOpeningPending}>Save Opening Pending</Btn>
  </div>
</Modal>
    </div>
  );
}

function InvoicePage({ data, update }) {
  const [partyF, setPartyF] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [preview, setPreview] = useState(null);
  const [manualBillNo, setManualBillNo] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [invoiceHistory, setInvoiceHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("bhukker_invoice_history");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const parties = [...new Set(data.trips.map(t=>t.partyName).filter(Boolean))];

  const saveInvoiceToHistory = (inv) => {
    const history = [...invoiceHistory, { ...inv, generatedAt: new Date().toISOString() }];
    setInvoiceHistory(history);
    localStorage.setItem("bhukker_invoice_history", JSON.stringify(history));
  };

  const generateInvoice = () => {
    if (!partyF) return alert("Select a party");
    const trips = data.trips.filter(t=>t.partyName===partyF&&tripMonth(t)===month);
    if (!trips.length) return alert("No trips found for this party/month");
    
    // Use manual bill number or generate default
    let billNo = manualBillNo;
    if (!billNo) {
      billNo = `BTC/${new Date().getFullYear()}/${String((data.invoiceCounter||1)).padStart(4,"0")}`;
      update("invoiceCounter",(data.invoiceCounter||1)+1);
    }
    
    const inv = {
      billNo, 
      date: new Date().toISOString().slice(0,10),
      party: data.parties.find(p=>p.name===partyF)||{name:partyF},
      trips, month,
      totalFreight: trips.reduce((s,t)=>s+(Number(t.freight)||0),0),
      totalReceived: trips.reduce((s,t)=>s+(Number(t.advance)||0)+(Number(t.paymentReceived)||0),0),
      totalPending: trips.reduce((s,t)=>s+(Number(t.pending)||0),0),
    };
    
    saveInvoiceToHistory(inv);
    setPreview(inv);
    setManualBillNo(""); // Reset after generation
  };

  const deleteInvoice = (index) => {
    if (!confirm("Delete this invoice from history?")) return;
    const newHistory = invoiceHistory.filter((_, i) => i !== index);
    setInvoiceHistory(newHistory);
    localStorage.setItem("bhukker_invoice_history", JSON.stringify(newHistory));
  };

  // Filter history by month
  const historyByMonth = {};
  invoiceHistory.forEach(inv => {
    const m = inv.month;
    if (!historyByMonth[m]) historyByMonth[m] = [];
    historyByMonth[m].push(inv);
  });

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:"#1a1a2e"}}>Invoice / Bill Generator</h2>
        <Btn onClick={() => setShowHistory(!showHistory)} color="#6a1b9a">
          {showHistory ? "📝 New Invoice" : "📜 Invoice History"}
        </Btn>
      </div>

      {!showHistory ? (
        <Card style={{marginBottom:20}}>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
            <div style={{flex:1,minWidth:200}}>
              <Field label="Select Party">
                <select value={partyF} onChange={e=>setPartyF(e.target.value)} style={inp}>
                  <option value="">Choose Party...</option>
                  {parties.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>
            <div style={{flex:1,minWidth:160}}>
              <Field label="Month">
                <select value={month} onChange={e=>setMonth(e.target.value)} style={inp}>
                  {monthOptions().map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
                </select>
              </Field>
            </div>
            <div style={{flex:1,minWidth:200}}>
              <Field label="Bill Number (Optional)">
                <input 
                  type="text" 
                  value={manualBillNo} 
                  onChange={e=>setManualBillNo(e.target.value)}
                  placeholder="Leave empty for auto" 
                  style={inp} 
                />
              </Field>
            </div>
            <div style={{paddingBottom:14}}>
              <Btn onClick={generateInvoice} color="#1a1a2e">Generate Invoice</Btn>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>Invoice History</div>
          {Object.keys(historyByMonth).sort().reverse().map(month => (
            <div key={month} style={{marginBottom:20}}>
              <div style={{fontSize:14,fontWeight:700,color:"#1565c0",marginBottom:10,background:"#e3f2fd",padding:"6px 12px",borderRadius:6}}>
                {getMonthLabel(month)}
              </div>
              {historyByMonth[month].map((inv, idx) => (
                <div key={idx} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f0f0f0"}}>
                  <div>
                    <div style={{fontWeight:600}}>Bill No: {inv.billNo}</div>
                    <div style={{fontSize:12,color:"#888"}}>Party: {inv.party.name} · Date: {inv.date}</div>
                    <div style={{fontSize:12}}>Amount: {fmt(inv.totalFreight)} | Pending: {fmt(inv.totalPending)}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <Btn small outline onClick={() => setPreview(inv)}>View</Btn>
                    <Btn small danger onClick={() => deleteInvoice(idx)}>Del</Btn>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {invoiceHistory.length === 0 && <EmptyState text="No invoices generated yet" />}
        </Card>
      )}

      {preview && <InvoicePreview inv={preview} settings={data.settings} onClose={() => setPreview(null)} />}
    </div>
  );
}

function InvoicePreview({ inv, settings, onClose }) {
  const [showReceivedDates, setShowReceivedDates] = useState(true);
  
  // Bank details for invoice
  const bankDetails = {
    bankName: "IDBI BANK",
    accountNumber: "0121102000039835",
    ifscCode: "IBKL0000121",
    upiNumber: "9812181416@ibl", // You can change this to actual UPI ID
    upiPhone: "9812181416"
  };
  
  const printInvoice = () => {
    const printContent = document.getElementById("invoice-print");
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${inv.billNo}</title>
          <style>
            @page {
              size: A4;
              margin: 1.5cm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Times New Roman', Arial, sans-serif;
              margin: 0;
              padding: 0;
              font-size: 12px;
              line-height: 1.4;
              color: #000;
              background: #fff;
            }
            .invoice-container {
              max-width: 100%;
              margin: 0 auto;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            th, td {
              border: 1px solid #000;
              padding: 8px 10px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
              text-align: center;
            }
            td:last-child, th:last-child {
              text-align: right;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            .company-name {
              font-size: 22px;
              font-weight: bold;
              letter-spacing: 2px;
            }
            .company-details {
              font-size: 10px;
              margin-top: 5px;
            }
            .bill-details {
              margin: 15px 0;
              display: flex;
              justify-content: space-between;
            }
            .footer {
              margin-top: 30px;
              display: flex;
              justify-content: space-between;
            }
            .signature {
              text-align: center;
              margin-top: 40px;
            }
            .signature-line {
              border-top: 1px solid #000;
              width: 200px;
              margin-top: 30px;
              padding-top: 5px;
            }
            .received-payments {
              margin-top: 20px;
              font-size: 11px;
            }
            .received-payments table {
              width: 60%;
              margin: 10px 0;
            }
            .received-payments th, .received-payments td {
              border: 1px solid #ccc;
              padding: 5px 8px;
            }
            .bank-details {
              margin-top: 20px;
              padding: 10px;
              background: #f8f8f8;
              border: 1px solid #ddd;
              font-size: 10px;
            }
            .bank-details table {
              width: 100%;
              border: none;
              margin: 5px 0;
            }
            .bank-details td {
              border: none;
              padding: 4px 8px;
            }
            .no-print {
              display: none;
            }
            @media print {
              .no-print {
                display: none;
              }
              body {
                margin: 0;
                padding: 0;
              }
              .received-payments {
                page-break-inside: avoid;
              }
              .bank-details {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            ${document.getElementById("invoice-print-content").innerHTML}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.onafterprint = () => printWindow.close();
  };

  // Get payment history for this party and month
  let paymentHistory = [];
  try {
    const savedPayments = localStorage.getItem("bhukker_transport_v1");
    if (savedPayments) {
      const parsed = JSON.parse(savedPayments);
      paymentHistory = (parsed.payments || []).filter(p => 
        p.partyName === inv.party.name && p.date?.slice(0,7) === inv.month
      );
    }
  } catch(e) {}

  // Get received amounts from trips
  const receivedFromTrips = inv.trips.reduce((sum, t) => sum + (Number(t.advance) || 0) + (Number(t.paymentReceived) || 0), 0);

  return (
    <div>
      <div style={{display:"flex", gap:10, marginBottom:16, justifyContent:"flex-end"}} className="no-print">
        <Btn onClick={() => setShowReceivedDates(!showReceivedDates)} outline>
          {showReceivedDates ? "Hide" : "Show"} Received Details
        </Btn>
        <Btn onClick={printInvoice}>🖨 Print Invoice</Btn>
        <Btn outline onClick={onClose}>Close</Btn>
      </div>
      
      <div id="invoice-print-content">
        <div style={{background:"#fff", padding:"20px"}}>
          {/* Header */}
          <div style={{borderBottom:"3px solid #1a1a2e", paddingBottom:"16px", marginBottom:"16px"}}>
            <div style={{display:"flex", justifyContent:"space-between", fontSize:"11px", color:"#555", marginBottom:"8px"}}>
              <div>GSTIN: {settings.gstin}</div>
              <div>{settings.jurisdiction}</div>
              <div>Ph. {settings.phone}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"24px", fontWeight:"900", letterSpacing:"2px", color:"#1a1a2e"}}>{settings.companyName}</div>
              <div style={{fontSize:"12px", color:"#555", letterSpacing:"1px", marginTop:"4px"}}>{settings.tagline}</div>
              <div style={{fontSize:"10px", color:"#777", marginTop:"4px"}}>{settings.address}</div>
            </div>
          </div>

          {/* Bill To & Bill No */}
          <div style={{display:"flex", justifyContent:"space-between", marginBottom:"16px", fontSize:"12px"}}>
            <div>
              <div style={{fontWeight:"700", fontSize:"14px", marginBottom:"4px"}}>Bill No: {inv.billNo}</div>
              <div><strong>To:</strong> {inv.party.name}</div>
              {inv.party.contact && <div>{inv.party.contact}</div>}
              {inv.party.mobile && <div>Mobile: {inv.party.mobile}</div>}
              {inv.party.gst && <div>GST: {inv.party.gst}</div>}
            </div>
            <div style={{textAlign:"right"}}>
              <div><strong>Date:</strong> {inv.date}</div>
              <div><strong>Period:</strong> {getMonthLabel(inv.month)}</div>
            </div>
          </div>

          {/* Trip Details Table */}
          <table style={{width:"100%", borderCollapse:"collapse", fontSize:"11px", marginBottom:"16px"}}>
            <thead>
              <tr style={{background:"#1a1a2e", color:"#fff"}}>
                <th style={{padding:"8px 10px", textAlign:"center", border:"1px solid #000"}}>Sr No</th>
                <th style={{padding:"8px 10px", textAlign:"center", border:"1px solid #000"}}>Date</th>
                <th style={{padding:"8px 10px", textAlign:"center", border:"1px solid #000"}}>Truck No</th>
                <th style={{padding:"8px 10px", textAlign:"center", border:"1px solid #000"}}>From</th>
                <th style={{padding:"8px 10px", textAlign:"center", border:"1px solid #000"}}>To</th>
                <th style={{padding:"8px 10px", textAlign:"center", border:"1px solid #000"}}>Description</th>
                <th style={{padding:"8px 10px", textAlign:"right", border:"1px solid #000"}}>Freight (₹)</th>
              </tr>
            </thead>
            <tbody>
              {inv.trips.map((t, i) => (
                <tr key={t.id} style={{borderBottom:"1px solid #ddd", background:i%2?"#f9f9f9":"#fff"}}>
                  <td style={{padding:"7px 10px", textAlign:"center", border:"1px solid #000"}}>{i+1}</td>
                  <td style={{padding:"7px 10px", border:"1px solid #000"}}>{t.date}</td>
                  <td style={{padding:"7px 10px", fontWeight:"600", border:"1px solid #000"}}>{t.truckNumber}</td>
                  <td style={{padding:"7px 10px", border:"1px solid #000"}}>{t.from}</td>
                  <td style={{padding:"7px 10px", border:"1px solid #000"}}>{t.to}</td>
                  <td style={{padding:"7px 10px", border:"1px solid #000"}}>{t.material}</td>
                  <td style={{padding:"7px 10px", textAlign:"right", fontWeight:"600", border:"1px solid #000"}}>₹{fmtN(t.freight)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <div style={{display:"flex", justifyContent:"flex-end", marginBottom:"20px"}}>
            <div style={{width:"280px"}}>
              <div style={{display:"flex", justifyContent:"space-between", padding:"6px 12px", borderBottom:"1px solid #eee"}}>
                <span>Total Freight</span>
                <span style={{fontWeight:"bold"}}>₹{fmtN(inv.totalFreight)}</span>
              </div>
              <div style={{display:"flex", justifyContent:"space-between", padding:"6px 12px", borderBottom:"1px solid #eee"}}>
                <span>Amount Received</span>
                <span style={{color:"#2e7d32", fontWeight:"bold"}}>₹{fmtN(inv.totalReceived)}</span>
              </div>
              <div style={{display:"flex", justifyContent:"space-between", padding:"8px 12px", background:"#f5f5f5", fontWeight:"bold"}}>
                <span>Balance Payable</span>
                <span style={{color:"#c62828"}}>₹{fmtN(inv.totalPending)}</span>
              </div>
            </div>
          </div>

          {/* Bank Details Section - NEW */}
          <div className="bank-details" style={{marginTop:"20px", padding:"12px", background:"#f8f8f8", border:"1px solid #ddd", borderRadius:"4px"}}>
            <div style={{fontWeight:"bold", fontSize:"12px", marginBottom:"8px", borderBottom:"1px solid #999", paddingBottom:"4px"}}>
              💳 BANK PAYMENT DETAILS
            </div>
            <table style={{width:"100%", border:"none", fontSize:"10px"}}>
              <tbody>
                <tr>
                  <td style={{width:"120px", padding:"4px 8px", border:"none", fontWeight:"bold"}}>Bank Name:</td>
                  <td style={{padding:"4px 8px", border:"none"}}>{bankDetails.bankName}</td>
                  <td style={{width:"120px", padding:"4px 8px", border:"none", fontWeight:"bold"}}>A/C No.:</td>
                  <td style={{padding:"4px 8px", border:"none"}}>{bankDetails.accountNumber}</td>
                </tr>
                <tr>
                  <td style={{padding:"4px 8px", border:"none", fontWeight:"bold"}}>IFSC Code:</td>
                  <td style={{padding:"4px 8px", border:"none"}}>{bankDetails.ifscCode}</td>
                  <td style={{padding:"4px 8px", border:"none", fontWeight:"bold"}}>UPI ID / No.:</td>
                  <td style={{padding:"4px 8px", border:"none"}}>{bankDetails.upiPhone}</td>
                </tr>
              </tbody>
            </table>
            <div style={{marginTop:"8px", fontSize:"10px", color:"#555", textAlign:"center", borderTop:"1px dashed #ccc", paddingTop:"6px"}}>
              📱 UPI Payment: {bankDetails.upiPhone} (Google Pay / PhonePe / Paytm)
            </div>
          </div>

          {/* Received Payments Details */}
          {showReceivedDates && (paymentHistory.length > 0 || receivedFromTrips > 0) && (
            <div className="received-payments" style={{marginTop:"20px"}}>
              <div style={{fontWeight:"bold", fontSize:"12px", marginBottom:"8px", borderBottom:"1px solid #000", paddingBottom:"4px"}}>
                Payment Received Details
              </div>
              <table style={{width:"70%", fontSize:"10px"}}>
                <thead>
                  <tr>
                    <th style={{border:"1px solid #000", padding:"5px 8px", textAlign:"center"}}>Date</th>
                    <th style={{border:"1px solid #000", padding:"5px 8px", textAlign:"center"}}>Mode</th>
                    <th style={{border:"1px solid #000", padding:"5px 8px", textAlign:"center"}}>Reference</th>
                    <th style={{border:"1px solid #000", padding:"5px 8px", textAlign:"right"}}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((p, idx) => (
                    <tr key={idx}>
                      <td style={{border:"1px solid #000", padding:"5px 8px"}}>{p.date}</td>
                      <td style={{border:"1px solid #000", padding:"5px 8px"}}>{p.mode}</td>
                      <td style={{border:"1px solid #000", padding:"5px 8px"}}>{p.reference || "-"}</td>
                      <td style={{border:"1px solid #000", padding:"5px 8px", textAlign:"right"}}>₹{fmtN(p.amount)}</td>
                    </tr>
                  ))}
                  {paymentHistory.length === 0 && receivedFromTrips > 0 && (
                    <tr>
                      <td colSpan="4" style={{border:"1px solid #000", padding:"5px 8px", textAlign:"center"}}>
                        Received via trip advances: ₹{fmtN(receivedFromTrips)}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{fontWeight:"bold"}}>
                    <td colSpan="3" style={{border:"1px solid #000", padding:"5px 8px", textAlign:"right"}}>Total Received:</td>
                    <td style={{border:"1px solid #000", padding:"5px 8px", textAlign:"right"}}>₹{fmtN(inv.totalReceived)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Footer */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginTop:"30px"}}>
            <div style={{fontSize:"9px", color:"#777"}}>
              <div>Subject to Panipat Jurisdiction only</div>
              <div>E. &amp; O. E.</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{borderTop:"1px solid #000", paddingTop:"6px", width:"200px", fontSize:"10px"}}>
                For {settings.companyName}<br/>Authorized Signatory
              </div>
            </div>
          </div>
          
          {/* Checked by / Prepared by line */}
          <div style={{display:"flex", justifyContent:"space-between", marginTop:"20px", fontSize:"9px", color:"#888", borderTop:"1px solid #eee", paddingTop:"10px"}}>
            <div>Checked by: _________________</div>
            <div>Prepared by: _________________</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsPage({ data }) {
  const [month, setMonth] = useState(currentMonth);
  const [activeTab, setActiveTab] = useState("monthly");
  const [truckMonth, setTruckMonth] = useState(currentMonth); // Changed to currentMonth instead of ""
  const [selectedTruckDetail, setSelectedTruckDetail] = useState(null);

  const trips = data.trips.filter(t => tripMonth(t) === month);

  // Function to calculate complete truck P&L (same as TrucksPage)
  const getTruckCompletePL = (truckNumber, targetMonth) => {
    // Get trips for the selected month ONLY
    const allTrips = data.trips.filter(t => t.truckNumber === truckNumber);
    const filteredTrips = allTrips.filter(t => tripMonth(t) === targetMonth);
    
    const tripIncome = filteredTrips.reduce((s, t) => s + (Number(t.freight) || 0), 0);
    const tripExpenses = {
      diesel: filteredTrips.reduce((s, t) => s + (Number(t.diesel) || 0), 0),
      cng: filteredTrips.reduce((s, t) => s + (Number(t.cng) || 0), 0),
      toll: filteredTrips.reduce((s, t) => s + (Number(t.toll) || 0), 0),
      driverAdvance: filteredTrips.reduce((s, t) => s + (Number(t.driverAdvance) || 0), 0),
      otherExpense: filteredTrips.reduce((s, t) => s + (Number(t.otherExpense) || 0), 0),
    };
    const totalTripExpenses = Object.values(tripExpenses).reduce((a, b) => a + b, 0);
    
    // General expenses for this specific truck for the selected month
    const generalExpenses = (data.generalExpenses || []).filter(e => 
      e.vehicleNumber === truckNumber && e.date?.slice(0,7) === targetMonth
    );
    const totalGeneralExpenses = generalExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    
    // Staff salary for driver for the selected month
    const truckDriver = data.drivers.find(d => d.truck === truckNumber);
    const driverSalaries = (data.staffSalaries || []).filter(s => 
      s.staffName === truckDriver?.name && s.salaryMonth === targetMonth
    );
    const totalDriverSalary = driverSalaries.reduce((s, sal) => s + (Number(sal.netAmount) || 0), 0);
    
    const truckData = data.trucks.find(t => t.number === truckNumber);
    
    // EMI - monthly
    const monthlyEmi = Number(truckData?.emiAmount) || 0;
    
    // Annual costs - divide by 12, but only if document is valid
    const getMonthlyCost = (expiryDate, annualAmount) => {
      if (!expiryDate || !annualAmount || annualAmount <= 0) return 0;
      const expiry = new Date(expiryDate);
      const current = new Date(targetMonth + "-01");
      if (expiry < current) return 0;
      return Number(annualAmount) / 12;
    };
    
    const monthlyInsurance = getMonthlyCost(truckData?.insuranceExpiry, truckData?.insuranceAmount);
    const monthlyPermit = getMonthlyCost(truckData?.permitExpiry, truckData?.permitAmount);
    const monthlyTax = getMonthlyCost(truckData?.taxExpiry, truckData?.taxAmount);
    const monthlyFitness = getMonthlyCost(truckData?.fitnessExpiry, truckData?.fitnessAmount);
    
    const totalFixedExpenses = monthlyEmi + monthlyInsurance + monthlyPermit + monthlyTax + monthlyFitness;
    const totalExpenses = totalTripExpenses + totalGeneralExpenses + totalDriverSalary + totalFixedExpenses;
    const netProfit = tripIncome - totalExpenses;
    
    return {
      truckNumber,
      truckData,
      tripIncome,
      tripExpenses: totalTripExpenses,
      generalExpenses: totalGeneralExpenses,
      driverSalary: totalDriverSalary,
      fixedExpenses: totalFixedExpenses,
      totalExpenses,
      netProfit,
      trips: filteredTrips.length,
      breakdown: {
        diesel: tripExpenses.diesel,
        cng: tripExpenses.cng,
        toll: tripExpenses.toll,
        driverAdvance: tripExpenses.driverAdvance,
        otherExpense: tripExpenses.otherExpense,
        general: totalGeneralExpenses,
        salary: totalDriverSalary,
        emi: monthlyEmi,
        insurance: monthlyInsurance,
        permit: monthlyPermit,
        tax: monthlyTax,
        fitness: monthlyFitness
      },
      tripsList: filteredTrips,
      generalExpensesList: generalExpenses
    };
  };

  // Get all trucks with their P&L for selected month
  const truckPLData = data.trucks.map(truck => {
    const pl = getTruckCompletePL(truck.number, truckMonth);
    return pl;
  }).filter(pl => pl.trips > 0 || pl.generalExpenses > 0 || pl.driverSalary > 0); // Only show trucks with activity

  // Sort by profit (highest first)
  const sortedTruckPL = [...truckPLData].sort((a, b) => b.netProfit - a.netProfit);

  const partyPending = {};
  data.trips.filter(t => (Number(t.pending) || 0) > 0).forEach(t => {
    if (!t.partyName) return;
    partyPending[t.partyName] = (partyPending[t.partyName] || 0) + (Number(t.pending) || 0);
  });

  const monthlyData = {};
  data.trips.forEach(t => {
    const m = tripMonth(t);
    if (!m) return;
    if (!monthlyData[m]) monthlyData[m] = { freight: 0, profit: 0, trips: 0, pending: 0 };
    monthlyData[m].freight += Number(t.freight) || 0;
    monthlyData[m].profit += Number(t.netProfit) || 0;
    monthlyData[m].trips++;
  });
  
  data.trips.forEach(t => {
    const m = tripMonth(t);
    if (m && monthlyData[m]) {
      monthlyData[m].pending += Number(t.pending) || 0;
    }
  });

  const tabStyle = (tab) => ({
    padding: "10px 20px",
    border: "none",
    background: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    borderBottom: activeTab === tab ? "3px solid #1a1a2e" : "3px solid transparent",
    color: activeTab === tab ? "#1a1a2e" : "#888"
  });

  // Truck Detail Modal Component inside ReportsPage
  const TruckDetailView = ({ truckPL, onClose }) => {
    const [detailMonth, setDetailMonth] = useState(truckMonth);
    const [updatedPL, setUpdatedPL] = useState(truckPL);
    
    useEffect(() => {
      const newPL = getTruckCompletePL(truckPL.truckNumber, detailMonth);
      setUpdatedPL(newPL);
    }, [detailMonth]);
    
    return (
      <div>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
          <div>
            <div style={{fontSize:18, fontWeight:700}}>{updatedPL.truckNumber}</div>
            <div style={{fontSize:12, color:"#888"}}>{updatedPL.truckData?.ownership} · {updatedPL.truckData?.fuelType}</div>
            <div style={{fontSize:12}}>Driver: {updatedPL.truckData?.driver || "Not assigned"}</div>
          </div>
          <div style={{display:"flex", gap:10, alignItems:"center"}}>
            <select value={detailMonth} onChange={e=>setDetailMonth(e.target.value)} style={{...inp, width:140, padding:"6px 10px"}}>
              {monthOptions().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
            <Btn small outline onClick={onClose}>Close</Btn>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20}}>
          <StatCard label="Trips" value={updatedPL.trips} color="blue" />
          <StatCard label="Total Income" value={fmt(updatedPL.tripIncome)} color="green" />
          <StatCard label="Total Expenses" value={fmt(updatedPL.totalExpenses)} color="red" />
          <StatCard label="Net Profit/Loss" value={fmt(updatedPL.netProfit)} color={updatedPL.netProfit >= 0 ? "teal" : "red"} />
        </div>
        
        {/* Expense Breakdown */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20}}>
          <Card>
            <div style={{fontWeight:700, marginBottom:12}}>🚛 Trip Expenses</div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eee"}}>
              <span>Diesel</span><span>{fmt(updatedPL.breakdown.diesel)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eee"}}>
              <span>CNG</span><span>{fmt(updatedPL.breakdown.cng)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eee"}}>
              <span>Toll</span><span>{fmt(updatedPL.breakdown.toll)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eee"}}>
              <span>Driver Advance</span><span>{fmt(updatedPL.breakdown.driverAdvance)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", marginTop:5, background:"#fff3e0", fontWeight:700}}>
              <span>Total Trip Expenses</span><span style={{color:"#e65100"}}>{fmt(updatedPL.tripExpenses)}</span>
            </div>
          </Card>
          
          <Card>
            <div style={{fontWeight:700, marginBottom:12}}>🏢 Other Expenses</div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eee"}}>
              <span>General Expenses</span><span>{fmt(updatedPL.generalExpenses)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eee"}}>
              <span>Driver Salary</span><span>{fmt(updatedPL.driverSalary)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eee"}}>
              <span>Monthly EMI</span><span>{fmt(updatedPL.breakdown.emi)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eee"}}>
              <span>Insurance (Monthly)</span><span>{fmt(updatedPL.breakdown.insurance)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eee"}}>
              <span>Permit (Monthly)</span><span>{fmt(updatedPL.breakdown.permit)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", marginTop:5, background:"#ffebee", fontWeight:700}}>
              <span>Total Other Expenses</span><span style={{color:"#c62828"}}>{fmt(updatedPL.generalExpenses + updatedPL.driverSalary + updatedPL.breakdown.emi + updatedPL.breakdown.insurance + updatedPL.breakdown.permit + updatedPL.breakdown.tax + updatedPL.breakdown.fitness)}</span>
            </div>
          </Card>
        </div>
        
        {/* Trip History */}
        <Card>
          <div style={{fontWeight:700, marginBottom:12}}>📋 Trip History ({updatedPL.trips} trips)</div>
          {updatedPL.tripsList.length === 0 ? (
            <EmptyState text="No trips for this period" />
          ) : (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
                <thead>
                  <tr style={{background:"#f8f8f8", borderBottom:"2px solid #eee"}}>
                    <th style={{padding:"8px", textAlign:"left"}}>Date</th>
                    <th style={{padding:"8px", textAlign:"left"}}>Party</th>
                    <th style={{padding:"8px", textAlign:"left"}}>Route</th>
                    <th style={{padding:"8px", textAlign:"right"}}>Freight</th>
                    <th style={{padding:"8px", textAlign:"right"}}>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {updatedPL.tripsList.map(trip => (
                    <tr key={trip.id} style={{borderBottom:"1px solid #f0f0f0"}}>
                      <td style={{padding:"8px"}}>{trip.date}</td>
                      <td style={{padding:"8px", fontWeight:500}}>{trip.partyName}</td>
                      <td style={{padding:"8px", fontSize:11}}>{trip.from} → {trip.to}</td>
                      <td style={{padding:"8px", textAlign:"right"}}>{fmt(trip.freight)}</td>
                      <td style={{padding:"8px", textAlign:"right", color: (trip.netProfit || 0) >= 0 ? "#2e7d32" : "#c62828"}}>
                        {fmt(trip.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>Reports</h2>
        <select value={month} onChange={e => setMonth(e.target.value)} style={{ ...inp, width: 160 }}>
          {monthOptions().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, borderBottom: "1px solid #eee", marginBottom: 20 }}>
        <button style={tabStyle("monthly")} onClick={() => setActiveTab("monthly")}>📊 Monthly Summary</button>
        <button style={tabStyle("truckwise")} onClick={() => setActiveTab("truckwise")}>🚛 Truck-wise Profit</button>
        <button style={tabStyle("pnl")} onClick={() => setActiveTab("pnl")}>📈 Profit & Loss Statement</button>
      </div>

      {/* Monthly Summary Tab */}
      {activeTab === "monthly" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Monthly Summary ({getMonthLabel(month)})</div>
              {[
                ["Trips", trips.length],
                ["Total Freight", fmt(trips.reduce((s, t) => s + (Number(t.freight) || 0), 0))],
                ["Total Expenses", fmt(trips.reduce((s, t) => s + (Number(t.diesel) || 0) + (Number(t.cng) || 0) + (Number(t.toll) || 0) + (Number(t.otherExpense) || 0), 0))],
                ["Net Profit", fmt(trips.reduce((s, t) => s + (Number(t.netProfit) || 0), 0))],
                ["Pending", fmt(trips.reduce((s, t) => s + (Number(t.pending) || 0), 0))],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <span style={{ color: "#666" }}>{l}</span><span style={{ fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </Card>

            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Fuel Breakdown ({getMonthLabel(month)})</div>
              {[
                ["Diesel Expense", fmt(trips.reduce((s, t) => s + (Number(t.diesel) || 0), 0)), "orange"],
                ["CNG Expense", fmt(trips.reduce((s, t) => s + (Number(t.cng) || 0), 0)), "teal"],
                ["Toll Expense", fmt(trips.reduce((s, t) => s + (Number(t.toll) || 0), 0)), "blue"],
              ].map(([l, v, c]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <span style={{ color: "#666" }}>{l}</span><Badge color={c}>{v}</Badge>
                </div>
              ))}
            </Card>
          </div>

          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Month-wise Performance</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8f8f8", borderBottom: "2px solid #eee" }}>
                    {["Month", "Trips", "Freight", "Expenses", "Profit/Loss", "Pending"].map(h => (
                      <th key={h} style={{ textAlign: h === "Month" || h === "Trips" ? "left" : "right", padding: "10px 12px", color: "#666", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(monthlyData)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([m, s]) => {
                      const mTrips = data.trips.filter(t => tripMonth(t) === m);
                      const expenses = mTrips.reduce((sum, t) => sum + (Number(t.diesel) || 0) + (Number(t.cng) || 0) + (Number(t.toll) || 0) + (Number(t.otherExpense) || 0), 0);
                      return (
                        <tr key={m} style={{ borderBottom: "1px solid #f0f0f0", background: m === month ? "#f0f4ff" : "#fff" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 500 }}>{getMonthLabel(m)}</td>
                          <td style={{ padding: "10px 12px" }}>{s.trips}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmt(s.freight)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#e65100" }}>{fmt(expenses)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: s.profit >= 0 ? "#2e7d32" : "#c62828" }}>{fmt(s.profit)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#c62828", fontWeight: 600 }}>{fmt(s.pending)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Truck-wise Profit Tab - Enhanced */}
      {activeTab === "truckwise" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Truck Performance for {getMonthLabel(truckMonth)}</div>
            <select value={truckMonth} onChange={e => setTruckMonth(e.target.value)} style={{ ...inp, width: 180 }}>
              {monthOptions().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>
          
          {sortedTruckPL.length === 0 ? (
            <EmptyState text="No truck activity found for selected period" />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px,1fr))", gap: 16 }}>
              {sortedTruckPL.map(truck => (
                <Card key={truck.truckNumber} style={{ cursor: "pointer" }} onClick={() => setSelectedTruckDetail(truck)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{truck.truckNumber}</div>
                    <Badge color={truck.netProfit >= 0 ? "green" : "red"}>{fmt(truck.netProfit)}</Badge>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, marginBottom: 8 }}>
                    <div>
                      <div style={{ color: "#888" }}>Trips</div>
                      <div style={{ fontWeight: 600 }}>{truck.trips}</div>
                    </div>
                    <div>
                      <div style={{ color: "#888" }}>Income</div>
                      <div style={{ fontWeight: 600, color: "#2e7d32" }}>{fmt(truck.tripIncome)}</div>
                    </div>
                    <div>
                      <div style={{ color: "#888" }}>Expenses</div>
                      <div style={{ fontWeight: 600, color: "#c62828" }}>{fmt(truck.totalExpenses)}</div>
                    </div>
                    <div>
                      <div style={{ color: "#888" }}>Margin</div>
                      <div style={{ fontWeight: 600 }}>{truck.tripIncome > 0 ? ((truck.netProfit / truck.tripIncome) * 100).toFixed(1) : 0}%</div>
                    </div>
                  </div>
                  
                  {/* Expense breakdown summary */}
                  <div style={{ fontSize: 11, color: "#666", borderTop: "1px solid #eee", paddingTop: 8, marginTop: 4 }}>
                    {truck.tripExpenses > 0 && <span>Trip: {fmt(truck.tripExpenses)} </span>}
                    {truck.generalExpenses > 0 && <span>| Gen: {fmt(truck.generalExpenses)} </span>}
                    {truck.driverSalary > 0 && <span>| Salary: {fmt(truck.driverSalary)} </span>}
                    {truck.fixedExpenses > 0 && <span>| Fixed: {fmt(truck.fixedExpenses)}</span>}
                  </div>
                  
                  <div style={{ marginTop: 8 }}>
                    <Btn small outline onClick={(e) => { e.stopPropagation(); setSelectedTruckDetail(truck); }}>View Details →</Btn>
                  </div>
                </Card>
              ))}
            </div>
          )}
          
          {/* Overall Summary */}
          {sortedTruckPL.length > 0 && (
            <Card style={{ marginTop: 20, background: "#1a1a2e", color: "#fff" }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>📊 Summary for {getMonthLabel(truckMonth)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Total Trips</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{sortedTruckPL.reduce((s, t) => s + t.trips, 0)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Total Income</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#81c784" }}>{fmt(sortedTruckPL.reduce((s, t) => s + t.tripIncome, 0))}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Total Expenses</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#ef9a9a" }}>{fmt(sortedTruckPL.reduce((s, t) => s + t.totalExpenses, 0))}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Total Profit</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: sortedTruckPL.reduce((s, t) => s + t.netProfit, 0) >= 0 ? "#81c784" : "#ef9a9a" }}>
                    {fmt(sortedTruckPL.reduce((s, t) => s + t.netProfit, 0))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Profit & Loss Statement Tab */}
      {activeTab === "pnl" && (
        <ProfitLossReport data={data} month={month} />
      )}
      
      {/* Truck Detail Modal */}
      <Modal open={!!selectedTruckDetail} onClose={() => setSelectedTruckDetail(null)} title="Truck Details" wide>
        {selectedTruckDetail && (
          <TruckDetailView truckPL={selectedTruckDetail} onClose={() => setSelectedTruckDetail(null)} />
        )}
      </Modal>
    </div>
  );
}

function SettingsPage({ data, update }) {
  const [s, setS] = useState(data.settings);

  const save = () => {
    update("settings", s);
    alert("Settings saved!");
  };

  const exportBackup = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      data
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `bhukker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
  };

  const importBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result);

        if (!backup.data) {
          alert("Invalid backup file");
          return;
        }

        localStorage.setItem("bhukker_transport_v1", JSON.stringify(backup.data));
        alert("Backup restored. Reloading...");
        window.location.reload();
      } catch {
        alert("Invalid backup file");
      }
    };

    reader.readAsText(file);
  };

  return (
    <div>
      <h2 style={{margin:"0 0 20px",fontSize:22,fontWeight:700,color:"#1a1a2e"}}>Settings</h2>

      <Card style={{maxWidth:600}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>Company Information</div>

        <Input label="Company Name" value={s.companyName} onChange={e=>setS(p=>({...p,companyName:e.target.value}))} />
        <Input label="Tagline" value={s.tagline} onChange={e=>setS(p=>({...p,tagline:e.target.value}))} />
        <Input label="GSTIN" value={s.gstin} onChange={e=>setS(p=>({...p,gstin:e.target.value}))} half />
        <Input label="Phone" value={s.phone} onChange={e=>setS(p=>({...p,phone:e.target.value}))} half />
        <Textarea label="Address" value={s.address} onChange={e=>setS(p=>({...p,address:e.target.value}))} />
        <Input label="Jurisdiction" value={s.jurisdiction} onChange={e=>setS(p=>({...p,jurisdiction:e.target.value}))} />

        <div style={{marginTop:8}}>
          <Btn onClick={save}>Save Settings</Btn>
        </div>

        <div style={{
          marginTop:20,
          display:"flex",
          gap:10,
          flexWrap:"wrap"
        }}>
          <Btn onClick={exportBackup}>Export Backup</Btn>

          <label style={{cursor:"pointer"}}>
            <input
              type="file"
              accept=".json"
              onChange={importBackup}
              style={{display:"none"}}
            />

            <span style={{
              display:"inline-block",
              padding:"10px 20px",
              background:"#1565c0",
              color:"#fff",
              borderRadius:8,
              fontWeight:600
            }}>
              Import Backup
            </span>
          </label>
          
        </div>
      </Card>
    </div>
  );
}

function TransportersPage({ data, update }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const blank = { name:"",mobile:"",address:"",trucks:"",notes:"" };
  const [f, setF] = useState(blank);

  const save = () => {
    if (!f.name) return alert("Name required");
    const list = [...data.transporters];
    if (editing) {
      const idx = list.findIndex(t=>t.id===editing.id);
      list[idx] = { ...editing, ...f };
    } else {
      list.push({ ...f, id: genId() });
    }
    update("transporters", list);
    setShowForm(false);
    setEditing(null);
    setF(blank);
  };

  const del = (id) => {
    if (!confirm("Delete?")) return;
    update("transporters", data.transporters.filter(t=>t.id!==id));
  };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:"#1a1a2e"}}>Transporters / Market Trucks</h2>
        <Btn onClick={()=>{setF(blank);setEditing(null);setShowForm(true)}}>+ Add Transporter</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
        {data.transporters.length===0&&<EmptyState text="No transporters added" />}
        {data.transporters.map(t=>{
          const trips = data.trips.filter(r=>r.transporterName===t.name||r.ownerType==="market"&&r.truckNumber===t.trucks);
          const commission = trips.filter(r=>r.ownerType==="market").reduce((s,r)=>s+(Number(r.commission)||0),0);
          return (
            <Card key={t.id}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <div>
                  <div style={{fontWeight:700,fontSize:16}}>{t.name}</div>
                  <div style={{color:"#888",fontSize:13}}>{t.mobile}</div>
                  {t.trucks&&<div style={{fontSize:13}}>Trucks: {t.trucks}</div>}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <Btn small outline onClick={()=>{setEditing(t);setF(t);setShowForm(true)}}>Edit</Btn>
                  <Btn small danger onClick={()=>del(t.id)}>Del</Btn>
                </div>
              </div>
              <div style={{fontSize:13,color:"#555"}}>
                <div>Market trips: {trips.length}</div>
                <div>Total commission: <span style={{fontWeight:700,color:"#2e7d32"}}>{fmt(commission)}</span></div>
              </div>
            </Card>
          );
        })}
      </div>
      <Modal open={showForm} onClose={()=>{setShowForm(false);setEditing(null)}} title={editing?"Edit Transporter":"New Transporter"}>
        <Input label="Name" value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} />
        <Input label="Mobile" value={f.mobile} onChange={e=>setF(p=>({...p,mobile:e.target.value}))} half />
        <Input label="Truck Numbers" value={f.trucks} onChange={e=>setF(p=>({...p,trucks:e.target.value}))} half />
        <Textarea label="Address" value={f.address} onChange={e=>setF(p=>({...p,address:e.target.value}))} />
        <Textarea label="Notes" value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} />
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Btn outline onClick={()=>setShowForm(false)}>Cancel</Btn>
          <Btn onClick={save}>Save</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// GENERAL EXPENSES PAGE - Add this before NAV
// ============================================================
function GeneralExpensesPage({ data, update }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [monthFilter, setMonthFilter] = useState(currentMonth);
  
  const blank = {
    date: new Date().toISOString().slice(0,10),
    category: "",
    subCategory: "",
    description: "",
    amount: 0,
    paymentMode: "cash",
    reference: "",
    vendorName: "",
    vehicleNumber: "",
    remarks: ""
  };
  const [f, setF] = useState(blank);

  const expenseCategories = {
    "Rent & Utilities": ["Office Rent", "Godown Rent", "Electricity", "Water Bill", "Internet", "Phone Bill"],
    "Vehicle Maintenance": ["Repair", "Service", "Tyre Change", "Battery", "Oil Change", "Spare Parts", "Painting"],
    "Challans & Fines": ["Traffic Challan", "Overload Fine", "RTO Fine", "Police Fine"],
    "Office Expenses": ["Stationery", "Printing", "Courier", "Cleaning", "Tea/Coffee", "Staff Refreshment"],
    "Staff Salaries": ["Office Staff Salary", "Helper Salary", "Accountant Salary", "Supervisor Salary"],
    "Insurance & Taxes": ["Truck Insurance", "Third Party Insurance", "Road Tax", "Fitness Certificate"],
    "Miscellaneous": ["Donation", "Gifts", "Entertainment", "Travel", "Other"]
  };

  const filteredExpenses = (data.generalExpenses || [])
    .filter(e => !monthFilter || e.date?.slice(0,7) === monthFilter)
    .sort((a,b) => b.date?.localeCompare(a.date));

  const totalExpenses = filteredExpenses.reduce((s,e) => s + (Number(e.amount) || 0), 0);
  
  const categoryTotals = {};
  filteredExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + (Number(e.amount) || 0);
  });

  const saveExpense = () => {
    if (!f.category || !f.amount) return alert("Category and amount required");
    const list = [...(data.generalExpenses || [])];
    if (editing) {
      const idx = list.findIndex(e => e.id === editing.id);
      list[idx] = { ...editing, ...f };
    } else {
      list.push({ ...f, id: genId() });
    }
    update("generalExpenses", list);
    setShowForm(false);
    setEditing(null);
    setF(blank);
  };

  const deleteExpense = (id) => {
    if (!confirm("Delete this expense?")) return;
    update("generalExpenses", (data.generalExpenses || []).filter(e => e.id !== id));
  };

  return (
    <div>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12}}>
        <h2 style={{margin:0, fontSize:22, fontWeight:700, color:"#1a1a2e"}}>General Expenses</h2>
        <div style={{display:"flex", gap:10}}>
          <select value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} style={{...inp, width:140}}>
            {monthOptions().map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <Btn onClick={()=>{setF(blank); setEditing(null); setShowForm(true)}}>+ Add Expense</Btn>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20}}>
        <StatCard label={`Total Expenses (${getMonthLabel(monthFilter)})`} value={fmt(totalExpenses)} color="red" />
        <StatCard label="Total Entries" value={filteredExpenses.length} color="blue" />
        <StatCard label="Categories" value={Object.keys(categoryTotals).length} color="purple" />
        <StatCard label="Avg per Entry" value={fmt(totalExpenses / (filteredExpenses.length || 1))} color="orange" />
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(250px,1fr))", gap:12, marginBottom:20}}>
        {Object.entries(categoryTotals).slice(0,6).map(([cat, amt]) => (
          <Card key={cat} style={{padding:"10px"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <span style={{fontWeight:600, fontSize:13}}>{cat}</span>
              <Badge color="red">{fmt(amt)}</Badge>
            </div>
            <div style={{fontSize:11, color:"#888", marginTop:4}}>{((amt/totalExpenses)*100).toFixed(1)}% of total</div>
          </Card>
        ))}
      </div>

      <Card style={{overflowX:"auto"}}>
        {filteredExpenses.length === 0 ? <EmptyState text="No expenses recorded" /> : (
          <table style={{width:"100%", borderCollapse:"collapse", fontSize:13, minWidth:800}}>
            <thead><tr style={{background:"#f8f8f8", borderBottom:"2px solid #eee"}}>
              <th style={{padding:"10px 12px"}}>Date</th><th style={{padding:"10px 12px"}}>Category</th>
              <th style={{padding:"10px 12px"}}>Description</th><th style={{padding:"10px 12px"}}>Vendor/Vehicle</th>
              <th style={{padding:"10px 12px", textAlign:"right"}}>Amount</th><th style={{padding:"10px 12px"}}>Mode</th>
              <th style={{padding:"10px 12px"}}>Actions</th>
            </tr></thead>
            <tbody>
              {filteredExpenses.map(e => (
                <tr key={e.id} style={{borderBottom:"1px solid #f0f0f0"}}>
                  <td style={{padding:"10px 12px"}}>{e.date}</td>
                  <td style={{padding:"10px 12px"}}><div style={{fontWeight:600}}>{e.category}</div><div style={{fontSize:11, color:"#888"}}>{e.subCategory}</div></td>
                  <td style={{padding:"10px 12px"}}>{e.description}</td>
                  <td style={{padding:"10px 12px", fontSize:12}}>{e.vendorName || e.vehicleNumber || "-"}</td>
                  <td style={{padding:"10px 12px", textAlign:"right", fontWeight:700, color:"#c62828"}}>{fmt(e.amount)}</td>
                  <td style={{padding:"10px 12px", fontSize:12}}>{e.paymentMode}</td>
                  <td style={{padding:"10px 12px"}}>
                    <Btn small outline onClick={()=>{setEditing(e); setF(e); setShowForm(true)}}>Edit</Btn>
                    <Btn small danger onClick={()=>deleteExpense(e.id)} style={{marginLeft:5}}>Del</Btn>
                  </td>
                 </tr>
              ))}
            </tbody>
            <tfoot><tr style={{background:"#ffebee", fontWeight:700}}>
              <td colSpan="4" style={{padding:"10px 12px", textAlign:"right"}}>TOTAL:</td>
              <td style={{padding:"10px 12px", textAlign:"right", color:"#c62828"}}>{fmt(totalExpenses)}</td>
              <td colSpan="2"></td>
            </tr></tfoot>
          </table>
        )}
      </Card>

      <Modal open={showForm} onClose={()=>{setShowForm(false); setEditing(null)}} title={editing?"Edit Expense":"Add Expense"} wide>
        <div style={{display:"flex", flexWrap:"wrap", gap:0}}>
          <Input label="Date" type="date" value={f.date} onChange={e=>setF(p=>({...p, date:e.target.value}))} half />
          <Select label="Category" value={f.category} onChange={e=>setF(p=>({...p, category:e.target.value, subCategory:""}))} half>
            <option value="">Select Category</option>
            {Object.keys(expenseCategories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </Select>
          {f.category && (
            <Select label="Sub Category" value={f.subCategory} onChange={e=>setF(p=>({...p, subCategory:e.target.value}))} half>
              <option value="">Select Sub Category</option>
              {expenseCategories[f.category].map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </Select>
          )}
          <Input label="Description" value={f.description} onChange={e=>setF(p=>({...p, description:e.target.value}))} half />
          <Input label="Amount (₹)" type="number" value={f.amount} onChange={e=>setF(p=>({...p, amount:e.target.value}))} half />
          <Select label="Payment Mode" value={f.paymentMode} onChange={e=>setF(p=>({...p, paymentMode:e.target.value}))} half>
            <option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="upi">UPI</option>
          </Select>
          <Input label="Vendor Name" value={f.vendorName} onChange={e=>setF(p=>({...p, vendorName:e.target.value}))} half />
          // In GeneralExpensesPage, add this inside the form where vehicle number is:
          <Input label="Vehicle Number" value={f.vehicleNumber} onChange={e=>setF(p=>({...p, vehicleNumber:e.target.value}))} half list="truck-list" />
          <datalist id="truck-list">
            {data.trucks.map(t => <option key={t.id} value={t.number} />)}
          </datalist>
        </div>
        <Textarea label="Remarks" value={f.remarks} onChange={e=>setF(p=>({...p, remarks:e.target.value}))} />
        <div style={{display:"flex", gap:10, justifyContent:"flex-end", marginTop:8}}>
          <Btn outline onClick={()=>setShowForm(false)}>Cancel</Btn>
          <Btn onClick={saveExpense}>Save Expense</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// STAFF SALARIES PAGE - FIXED TABLE SYNTAX
// ============================================================
function StaffSalariesPage({ data, update }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [monthFilter, setMonthFilter] = useState(currentMonth);
  
  const blank = {
    date: new Date().toISOString().slice(0,10),
    staffName: "",
    role: "",
    salaryMonth: currentMonth,
    basicSalary: 0,
    bonus: 0,
    deductions: 0,
    netAmount: 0,
    paymentMode: "cash",
    remarks: ""
  };
  const [f, setF] = useState(blank);

  // Auto-calculate net amount
  useEffect(() => {
    setF(prev => ({
      ...prev,
      netAmount: (Number(prev.basicSalary) || 0) + (Number(prev.bonus) || 0) - (Number(prev.deductions) || 0)
    }));
  }, [f.basicSalary, f.bonus, f.deductions]);

  const staffRoles = ["Driver", "Helper", "Office Staff", "Accountant", "Supervisor", "Cleaner", "Other"];

  const filteredSalaries = (data.staffSalaries || [])
    .filter(s => !monthFilter || s.salaryMonth === monthFilter)
    .sort((a,b) => b.date?.localeCompare(a.date));

  const totalSalary = filteredSalaries.reduce((s, sal) => s + (Number(sal.netAmount) || 0), 0);
  const totalBonus = filteredSalaries.reduce((s, sal) => s + (Number(sal.bonus) || 0), 0);
  const totalDeductions = filteredSalaries.reduce((s, sal) => s + (Number(sal.deductions) || 0), 0);

  const saveSalary = () => {
    if (!f.staffName || !f.netAmount) return alert("Staff name and amount required");
    const list = [...(data.staffSalaries || [])];
    if (editing) {
      const idx = list.findIndex(s => s.id === editing.id);
      list[idx] = { ...editing, ...f };
    } else {
      list.push({ ...f, id: genId() });
    }
    update("staffSalaries", list);
    setShowForm(false);
    setEditing(null);
    setF(blank);
  };

  const deleteSalary = (id) => {
    if (!confirm("Delete this salary entry?")) return;
    update("staffSalaries", (data.staffSalaries || []).filter(s => s.id !== id));
  };

  return (
    <div>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12}}>
        <h2 style={{margin:0, fontSize:22, fontWeight:700, color:"#1a1a2e"}}>Staff Salaries</h2>
        <div style={{display:"flex", gap:10}}>
          <select value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} style={{...inp, width:160}}>
            {monthOptions().map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <Btn onClick={()=>{setF(blank); setEditing(null); setShowForm(true)}}>+ Add Salary</Btn>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20}}>
        <StatCard label={`Total Salary (${getMonthLabel(monthFilter)})`} value={fmt(totalSalary)} color="orange" />
        <StatCard label="Bonus Given" value={fmt(totalBonus)} color="green" />
        <StatCard label="Deductions" value={fmt(totalDeductions)} color="red" />
        <StatCard label="Staff Count" value={filteredSalaries.length} color="blue" />
      </div>

      <Card style={{overflowX:"auto"}}>
        {filteredSalaries.length === 0 ? <EmptyState text="No salary records" /> : (
          <table style={{width:"100%", borderCollapse:"collapse", fontSize:13, minWidth:800}}>
            <thead>
              <tr style={{background:"#f8f8f8", borderBottom:"2px solid #eee"}}>
                <th style={{padding:"10px 12px"}}>Date</th>
                <th style={{padding:"10px 12px"}}>Staff Name</th>
                <th style={{padding:"10px 12px"}}>Role</th>
                <th style={{padding:"10px 12px", textAlign:"right"}}>Basic</th>
                <th style={{padding:"10px 12px", textAlign:"right"}}>Bonus</th>
                <th style={{padding:"10px 12px", textAlign:"right"}}>Deductions</th>
                <th style={{padding:"10px 12px", textAlign:"right"}}>Net</th>
                <th style={{padding:"10px 12px"}}>Mode</th>
                <th style={{padding:"10px 12px"}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSalaries.map(s => (
                <tr key={s.id} style={{borderBottom:"1px solid #f0f0f0"}}>
                  <td style={{padding:"10px 12px"}}>{s.date}</td>
                  <td style={{padding:"10px 12px", fontWeight:600}}>{s.staffName}</td>
                  <td style={{padding:"10px 12px"}}>{s.role}</td>
                  <td style={{padding:"10px 12px", textAlign:"right"}}>{fmt(s.basicSalary)}</td>
                  <td style={{padding:"10px 12px", textAlign:"right", color:"#2e7d32"}}>{fmt(s.bonus)}</td>
                  <td style={{padding:"10px 12px", textAlign:"right", color:"#c62828"}}>{fmt(s.deductions)}</td>
                  <td style={{padding:"10px 12px", textAlign:"right", fontWeight:700}}>{fmt(s.netAmount)}</td>
                  <td style={{padding:"10px 12px"}}>{s.paymentMode}</td>
                  <td style={{padding:"10px 12px"}}>
                    <Btn small outline onClick={()=>{setEditing(s); setF(s); setShowForm(true)}}>Edit</Btn>
                    {" "}
                    <Btn small danger onClick={()=>deleteSalary(s.id)}>Del</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{background:"#fff3e0", fontWeight:700}}>
                <td colSpan="3" style={{padding:"10px 12px", textAlign:"right"}}>TOTAL:</td>
                <td style={{padding:"10px 12px", textAlign:"right"}}>{fmt(filteredSalaries.reduce((s, sal) => s + (Number(sal.basicSalary)||0), 0))}</td>
                <td style={{padding:"10px 12px", textAlign:"right"}}>{fmt(totalBonus)}</td>
                <td style={{padding:"10px 12px", textAlign:"right"}}>{fmt(totalDeductions)}</td>
                <td style={{padding:"10px 12px", textAlign:"right", color:"#e65100"}}>{fmt(totalSalary)}</td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>

      <Modal open={showForm} onClose={()=>{setShowForm(false); setEditing(null)}} title={editing?"Edit Salary":"Add Salary"} wide>
        <div style={{display:"flex", flexWrap:"wrap", gap:0}}>
          <Input label="Date" type="date" value={f.date} onChange={e=>setF(p=>({...p, date:e.target.value}))} half />
          <Input label="Staff Name" value={f.staffName} onChange={e=>setF(p=>({...p, staffName:e.target.value}))} half />
          <Select label="Role" value={f.role} onChange={e=>setF(p=>({...p, role:e.target.value}))} half>
            <option value="">Select Role</option>
            {staffRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Select label="Salary Month" value={f.salaryMonth} onChange={e=>setF(p=>({...p, salaryMonth:e.target.value}))} half>
            {monthOptions().map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
          </Select>
        </div>
        <div style={{display:"flex", flexWrap:"wrap", gap:0}}>
          <Input label="Basic Salary (₹)" type="number" value={f.basicSalary} onChange={e=>setF(p=>({...p, basicSalary:e.target.value}))} half />
          <Input label="Bonus (₹)" type="number" value={f.bonus} onChange={e=>setF(p=>({...p, bonus:e.target.value}))} half />
          <Input label="Deductions (₹)" type="number" value={f.deductions} onChange={e=>setF(p=>({...p, deductions:e.target.value}))} half />
          <Select label="Payment Mode" value={f.paymentMode} onChange={e=>setF(p=>({...p, paymentMode:e.target.value}))} half>
            <option value="cash">Cash</option>
            <option value="bank">Bank Transfer</option>
            <option value="upi">UPI</option>
          </Select>
        </div>
        <div style={{background:"#e8f5e9", borderRadius:8, padding:"10px 14px", marginBottom:14}}>
          <div style={{fontSize:12, color:"#2e7d32", fontWeight:600}}>NET PAYABLE</div>
          <div style={{fontSize:18, fontWeight:700, color:"#2e7d32"}}>{fmt(f.netAmount)}</div>
        </div>
        <Textarea label="Remarks" value={f.remarks} onChange={e=>setF(p=>({...p, remarks:e.target.value}))} />
        <div style={{display:"flex", gap:10, justifyContent:"flex-end", marginTop:8}}>
          <Btn outline onClick={()=>setShowForm(false)}>Cancel</Btn>
          <Btn onClick={saveSalary}>Save Salary</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// OWNER DRAWINGS PAGE - Add this before NAV
// ============================================================
function OwnerDrawingsPage({ data, update }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [monthFilter, setMonthFilter] = useState(currentMonth);
  
  const blank = {
    date: new Date().toISOString().slice(0,10),
    type: "drawing",
    category: "",
    description: "",
    amount: 0,
    paymentMode: "cash",
    remarks: ""
  };
  const [f, setF] = useState(blank);

  const drawingCategories = ["Personal Withdrawal", "Family Expense", "Medical", "Education", "Travel", "Shopping"];
  const investmentCategories = ["Business Reinvestment", "New Vehicle", "Equipment", "Property"];

  const getCategories = () => f.type === "drawing" ? drawingCategories : investmentCategories;

  const filteredDrawings = (data.ownerDrawings || [])
    .filter(d => !monthFilter || d.date?.slice(0,7) === monthFilter)
    .sort((a,b) => b.date?.localeCompare(a.date));

  const totalDrawings = filteredDrawings.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalWithdrawals = filteredDrawings.filter(d => d.type === "drawing").reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalInvestments = filteredDrawings.filter(d => d.type === "investment").reduce((s, d) => s + (Number(d.amount) || 0), 0);

  const saveDrawing = () => {
    if (!f.amount) return alert("Amount required");
    const list = [...(data.ownerDrawings || [])];
    if (editing) {
      const idx = list.findIndex(d => d.id === editing.id);
      list[idx] = { ...editing, ...f };
    } else {
      list.push({ ...f, id: genId() });
    }
    update("ownerDrawings", list);
    setShowForm(false);
    setEditing(null);
    setF(blank);
  };

  const deleteDrawing = (id) => {
    if (!confirm("Delete this entry?")) return;
    update("ownerDrawings", (data.ownerDrawings || []).filter(d => d.id !== id));
  };

  return (
    <div>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12}}>
        <h2 style={{margin:0, fontSize:22, fontWeight:700, color:"#1a1a2e"}}>Owner's Drawings</h2>
        <div style={{display:"flex", gap:10}}>
          <select value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} style={{...inp, width:160}}>
            {monthOptions().map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <Btn onClick={()=>{setF(blank); setEditing(null); setShowForm(true)}}>+ Add Entry</Btn>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20}}>
        <StatCard label={`Total Drawings (${getMonthLabel(monthFilter)})`} value={fmt(totalDrawings)} color="orange" />
        <StatCard label="Personal Withdrawals" value={fmt(totalWithdrawals)} color="red" />
        <StatCard label="Business Investments" value={fmt(totalInvestments)} color="green" />
      </div>

      <Card style={{overflowX:"auto"}}>
        {filteredDrawings.length === 0 ? <EmptyState text="No owner entries" /> : (
          <table style={{width:"100%", borderCollapse:"collapse", fontSize:13, minWidth:600}}>
            <thead><tr style={{background:"#f8f8f8", borderBottom:"2px solid #eee"}}>
              <th>Date</th><th>Type</th><th>Category</th><th>Description</th><th style={{textAlign:"right"}}>Amount</th><th>Mode</th><th>Actions</th>
             </tr></thead>
            <tbody>
              {filteredDrawings.map(d => (
                <tr key={d.id} style={{borderBottom:"1px solid #f0f0f0"}}>
                  <td style={{padding:"10px 12px"}}>{d.date}</td>
                  <td><Badge color={d.type === "drawing" ? "orange" : "green"}>{d.type === "drawing" ? "Withdrawal" : "Investment"}</Badge></td>
                  <td>{d.category}</td><td>{d.description}</td>
                  <td style={{textAlign:"right", fontWeight:700, color:"#e65100"}}>{fmt(d.amount)}</td>
                  <td>{d.paymentMode}</td>
                  <td><Btn small outline onClick={()=>{setEditing(d); setF(d); setShowForm(true)}}>Edit</Btn>
                  <Btn small danger onClick={()=>deleteDrawing(d.id)} style={{marginLeft:5}}>Del</Btn></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr style={{background:"#fff3e0", fontWeight:700}}>
              <td colSpan="4" style={{textAlign:"right"}}>TOTAL:</td>
              <td style={{textAlign:"right", color:"#e65100"}}>{fmt(totalDrawings)}</td><td colSpan="2"></td>
            </tr></tfoot>
          </table>
        )}
      </Card>

      <Modal open={showForm} onClose={()=>{setShowForm(false); setEditing(null)}} title={editing?"Edit Entry":"Add Owner Entry"}>
        <Input label="Date" type="date" value={f.date} onChange={e=>setF(p=>({...p, date:e.target.value}))} half />
        <Select label="Type" value={f.type} onChange={e=>setF(p=>({...p, type:e.target.value, category:""}))} half>
          <option value="drawing">Personal Withdrawal</option>
          <option value="investment">Business Investment</option>
        </Select>
        <Select label="Category" value={f.category} onChange={e=>setF(p=>({...p, category:e.target.value}))} half>
          <option value="">Select Category</option>
          {getCategories().map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Input label="Description" value={f.description} onChange={e=>setF(p=>({...p, description:e.target.value}))} half />
        <Input label="Amount (₹)" type="number" value={f.amount} onChange={e=>setF(p=>({...p, amount:e.target.value}))} half />
        <Select label="Payment Mode" value={f.paymentMode} onChange={e=>setF(p=>({...p, paymentMode:e.target.value}))} half>
          <option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="upi">UPI</option>
        </Select>
        <Textarea label="Remarks" value={f.remarks} onChange={e=>setF(p=>({...p, remarks:e.target.value}))} />
        <div style={{display:"flex", gap:10, justifyContent:"flex-end", marginTop:8}}>
          <Btn outline onClick={()=>setShowForm(false)}>Cancel</Btn>
          <Btn onClick={saveDrawing}>Save Entry</Btn>
        </div>
      </Modal>
    </div>
  );
}
// ============================================================
// ENHANCED PROFIT & LOSS REPORT - Add this before NAV
// ============================================================
function ProfitLossReport({ data, month }) {
  // Get trip data for selected month
  const trips = data.trips.filter(t => tripMonth(t) === month);
  
  // 1. TRIP INCOME & EXPENSES
  const tripIncome = trips.reduce((s, t) => s + (Number(t.freight) || 0), 0);
  
  const tripExpenses = {
    diesel: trips.reduce((s, t) => s + (Number(t.diesel) || 0), 0),
    cng: trips.reduce((s, t) => s + (Number(t.cng) || 0), 0),
    toll: trips.reduce((s, t) => s + (Number(t.toll) || 0), 0),
    driverAdvance: trips.reduce((s, t) => s + (Number(t.driverAdvance) || 0), 0),
    otherExpense: trips.reduce((s, t) => s + (Number(t.otherExpense) || 0), 0),
    marketPayable: trips.filter(t => t.ownerType === "market").reduce((s, t) => s + (Number(t.amountPayable) || 0), 0),
  };
  const totalTripExpenses = Object.values(tripExpenses).reduce((a, b) => a + b, 0);
  const tripProfit = tripIncome - totalTripExpenses;

  // 2. GENERAL EXPENSES (Rent, Maintenance, Challans, Office, etc.)
  const generalExpenses = (data.generalExpenses || []).filter(e => e.date?.slice(0,7) === month);
  const generalExpensesByCategory = {};
  generalExpenses.forEach(e => {
    generalExpensesByCategory[e.category] = (generalExpensesByCategory[e.category] || 0) + (Number(e.amount) || 0);
  });
  const totalGeneralExpenses = generalExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // 3. STAFF SALARIES (excluding drivers - drivers handled in trip expenses)
  const staffSalaries = (data.staffSalaries || []).filter(s => s.salaryMonth === month);
  const totalStaffSalaries = staffSalaries.reduce((s, sal) => s + (Number(sal.netAmount) || 0), 0);
  const staffSalaryBreakdown = {};
  staffSalaries.forEach(s => {
    staffSalaryBreakdown[s.role] = (staffSalaryBreakdown[s.role] || 0) + (Number(s.netAmount) || 0);
  });

  // 4. OWNER DRAWINGS (not an expense but tracked for cash flow)
  const ownerDrawings = (data.ownerDrawings || []).filter(d => d.date?.slice(0,7) === month);
  const totalWithdrawals = ownerDrawings.filter(d => d.type === "drawing").reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalInvestments = ownerDrawings.filter(d => d.type === "investment").reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalOwnerDrawings = totalWithdrawals + totalInvestments;

  // 5. TOTAL BUSINESS EXPENSES (excluding owner personal expenses)
  const totalBusinessExpenses = totalTripExpenses + totalGeneralExpenses + totalStaffSalaries;
  const netBusinessProfit = tripIncome - totalBusinessExpenses;
  
  // 6. Cash flow summary
  const cashIn = (data.cashbook || []).filter(c => c.date?.slice(0,7) === month && c.type === "in").reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const cashOut = (data.cashbook || []).filter(c => c.date?.slice(0,7) === month && c.type === "out").reduce((s, c) => s + (Number(c.amount) || 0), 0);

  return (
    <div>
      {/* Summary Cards */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20}}>
        <StatCard label="Total Freight Income" value={fmt(tripIncome)} color="green" />
        <StatCard label="Total Business Expenses" value={fmt(totalBusinessExpenses)} color="red" />
        <StatCard label="Net Business Profit" value={fmt(netBusinessProfit)} color={netBusinessProfit >= 0 ? "teal" : "red"} />
        <StatCard label="Profit Margin" value={`${((netBusinessProfit / tripIncome) * 100).toFixed(1)}%`} color="blue" />
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        {/* LEFT COLUMN - INCOME & TRIP EXPENSES */}
        <div>
          {/* Income Section */}
          <Card style={{marginBottom:16}}>
            <div style={{fontWeight:700, fontSize:16, marginBottom:12, borderBottom:"2px solid #1a1a2e", paddingBottom:8}}>
              📈 INCOME
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #eee"}}>
              <span>Freight Income from Trips</span>
              <span style={{fontWeight:700, color:"#2e7d32"}}>{fmt(tripIncome)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", background:"#e8f5e9", marginTop:8, fontWeight:700}}>
              <span>TOTAL INCOME</span>
              <span style={{color:"#2e7d32"}}>{fmt(tripIncome)}</span>
            </div>
          </Card>

          {/* Trip Expenses Section */}
          <Card style={{marginBottom:16}}>
            <div style={{fontWeight:700, fontSize:16, marginBottom:12, borderBottom:"2px solid #e65100", paddingBottom:8}}>
              🚛 TRIP EXPENSES
            </div>
            {Object.entries(tripExpenses).map(([key, amount]) => amount > 0 && (
              <div key={key} style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #f0f0f0"}}>
                <span style={{color:"#666"}}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                <span>{fmt(amount)}</span>
              </div>
            ))}
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", marginTop:8, background:"#fff3e0", fontWeight:700}}>
              <span>Total Trip Expenses</span>
              <span style={{color:"#e65100"}}>{fmt(totalTripExpenses)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", background:"#e8f5e9", fontWeight:700}}>
              <span>Gross Profit from Trips</span>
              <span style={{color:"#2e7d32"}}>{fmt(tripProfit)}</span>
            </div>
          </Card>

          {/* General Expenses Section */}
          <Card>
            <div style={{fontWeight:700, fontSize:16, marginBottom:12, borderBottom:"2px solid #c62828", paddingBottom:8}}>
              🏢 GENERAL EXPENSES
            </div>
            {Object.entries(generalExpensesByCategory).map(([cat, amt]) => (
              <div key={cat} style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #f0f0f0"}}>
                <span style={{color:"#666"}}>{cat}</span>
                <span>{fmt(amt)}</span>
              </div>
            ))}
            {Object.keys(generalExpensesByCategory).length === 0 && (
              <div style={{color:"#888", textAlign:"center", padding:"16px"}}>No general expenses recorded</div>
            )}
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", marginTop:8, background:"#ffebee", fontWeight:700}}>
              <span>Total General Expenses</span>
              <span style={{color:"#c62828"}}>{fmt(totalGeneralExpenses)}</span>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN - SALARIES, OWNER & SUMMARY */}
        <div>
          {/* Staff Salaries Section */}
          <Card style={{marginBottom:16}}>
            <div style={{fontWeight:700, fontSize:16, marginBottom:12, borderBottom:"2px solid #1565c0", paddingBottom:8}}>
              👥 STAFF SALARIES
            </div>
            {Object.entries(staffSalaryBreakdown).map(([role, amt]) => (
              <div key={role} style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #f0f0f0"}}>
                <span style={{color:"#666"}}>{role}</span>
                <span>{fmt(amt)}</span>
              </div>
            ))}
            {Object.keys(staffSalaryBreakdown).length === 0 && (
              <div style={{color:"#888", textAlign:"center", padding:"16px"}}>No staff salaries recorded</div>
            )}
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", marginTop:8, background:"#e3f2fd", fontWeight:700}}>
              <span>Total Staff Salaries</span>
              <span style={{color:"#1565c0"}}>{fmt(totalStaffSalaries)}</span>
            </div>
          </Card>

          {/* Owner Drawings Section */}
          <Card style={{marginBottom:16}}>
            <div style={{fontWeight:700, fontSize:16, marginBottom:12, borderBottom:"2px solid #f57f17", paddingBottom:8}}>
              👤 OWNER'S DRAWINGS
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #f0f0f0"}}>
              <span style={{color:"#666"}}>Personal Withdrawals</span>
              <span>{fmt(totalWithdrawals)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #f0f0f0"}}>
              <span style={{color:"#666"}}>Business Investments</span>
              <span style={{color:"#2e7d32"}}>{fmt(totalInvestments)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", marginTop:8, background:"#fff3e0", fontWeight:700}}>
              <span>Total Drawings</span>
              <span style={{color:"#e65100"}}>{fmt(totalOwnerDrawings)}</span>
            </div>
          </Card>

          {/* FINAL SUMMARY */}
          <Card style={{background:"#1a1a2e", color:"#fff"}}>
            <div style={{fontWeight:700, fontSize:16, marginBottom:12, textAlign:"center"}}>
              📊 PROFIT & LOSS SUMMARY
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.2)"}}>
              <span>Total Income</span>
              <span>{fmt(tripIncome)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.2)"}}>
              <span>Total Business Expenses</span>
              <span>{fmt(totalBusinessExpenses)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"12px 0", background:"rgba(255,255,255,0.1)", marginTop:8, fontWeight:700, fontSize:14}}>
              <span>NET BUSINESS PROFIT</span>
              <span style={{color: netBusinessProfit >= 0 ? "#81c784" : "#ef9a9a"}}>{fmt(netBusinessProfit)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", marginTop:8, fontSize:12, color:"rgba(255,255,255,0.7)"}}>
              <span>Owner Drawings (Personal)</span>
              <span>{fmt(totalWithdrawals)}</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 0", fontSize:12, color:"rgba(255,255,255,0.7)"}}>
              <span>Reinvested into Business</span>
              <span style={{color:"#81c784"}}>{fmt(totalInvestments)}</span>
            </div>
          </Card>

          {/* Cash Flow Note */}
          <Card style={{marginTop:16, background:"#f5f5f5"}}>
            <div style={{fontSize:12, color:"#666"}}>
              <div style={{fontWeight:700, marginBottom:8}}>💰 Cash Flow Note:</div>
              <div>Cash In (from cashbook): {fmt(cashIn)}</div>
              <div>Cash Out (from cashbook): {fmt(cashOut)}</div>
              <div style={{marginTop:4, fontSize:11}}>
                * Profit/Loss may differ from cash flow due to credit transactions
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
// ============================================================
// MAIN APP
// ============================================================


const NAV = [
  {id:"dashboard",label:"Dashboard",icon:"🏠"},
  {id:"trips",label:"Trips",icon:"🚚"},
  {id:"parties",label:"Parties",icon:"🏢"},
  {id:"transporters",label:"Transporters",icon:"🔄"},
  {id:"cashbook",label:"Cash Book",icon:"💰"},
  {id:"payments",label:"Payments",icon:"💳"},
  {id:"pending",label:"Pending",icon:"⏳"},
  {id:"invoices",label:"Invoices",icon:"🧾"},
  {id:"trucks",label:"Trucks",icon:"🚛"},
  {id:"drivers",label:"Drivers",icon:"👤"},
  {id:"generalExpenses",label:"General Expenses",icon:"💰"},
  {id:"staffSalaries",label:"Staff Salaries",icon:"👥"},
  {id:"ownerDrawings",label:"Owner Drawings",icon:"👤"},
  {id:"reports",label:"Reports",icon:"📊"},
  {id:"settings",label:"Settings",icon:"⚙️"},
];

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
const [email, setEmail] = useState("");
const [pass, setPass] = useState("");
const [passErr, setPassErr] = useState(false);
const [authLoading, setAuthLoading] = useState(true);
const [firebaseUser, setFirebaseUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [pageAction, setPageAction] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { data, update, loading } = useStorage(firebaseUser);

  const login = async () => {
  try {
    setPassErr(false);

    await signInWithEmailAndPassword(
      auth,
      email,
      pass
    );

    setLoggedIn(true);

  } catch (error) {
    console.error(error);
    setPassErr(true);
  }
};
useEffect(() => {
  const unsub = onAuthStateChanged(auth, (user) => {
    setFirebaseUser(user);
    setLoggedIn(!!user);
    setAuthLoading(false);
  });

  return () => unsub();
}, []);

  const navigate = (pg, action) => {
    setPage(pg);
    setPageAction(action||null);
  };
if (authLoading || loading) {
  return (
    <div style={{
      minHeight:"100vh",
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      fontSize:18,
      fontWeight:700
    }}>
      Loading...
    </div>
  );
}
  if (!loggedIn) {
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
        background:"linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)"}}>
        <div style={{background:"#fff",borderRadius:16,padding:"2.5rem",width:380,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontSize:36,marginBottom:8}}>🚛</div>
            <div style={{fontSize:20,fontWeight:900,color:"#1a1a2e",letterSpacing:1}}>BHUKKER TRANSPORT CO.</div>
            <div style={{fontSize:12,color:"#888",letterSpacing:1}}>CUSTOMIZED TRANSPORT SOLUTION</div>
          </div>
          <div style={{fontSize:14,color:"#666",marginBottom:8,fontWeight:600}}>
  Admin Login
</div>

<input
  type="email"
  value={email}
  onChange={e=>{
    setEmail(e.target.value);
    setPassErr(false);
  }}
  placeholder="Enter email..."
  style={{
    ...inp,
    marginBottom:8,
    border:passErr?"2px solid #e53935":"1.5px solid #e0e0e0"
  }}
/>

<input type="password" value={pass} onChange={e=>{setPass(e.target.value);setPassErr(false)}}
            onKeyDown={e=>e.key==="Enter"&&login()}
            placeholder="Enter password..." style={{...inp,marginBottom:8,
              border:passErr?"2px solid #e53935":"1.5px solid #e0e0e0"}} />
          {passErr&&<div style={{color:"#e53935",fontSize:13,marginBottom:8}}>Invalid email or password</div>}
          
          <Btn onClick={login} style={{width:"100%"}}>Login →</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#f5f5f7"}}>
      {/* SIDEBAR */}
      <div style={{
        width:sidebarOpen?220:64,transition:"width .2s",
        background:"#1a1a2e",color:"#fff",display:"flex",flexDirection:"column",
        flexShrink:0,overflow:"hidden"
      }}>
        <div style={{padding:"1.25rem",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
          {sidebarOpen ? (
            <div>
              <div style={{fontSize:13,fontWeight:900,letterSpacing:1,color:"#fff"}}>BHUKKER TRANSPORT CO.</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:0.5}}>TRANSPORT SOLUTION</div>
            </div>
          ) : <div style={{fontSize:20,textAlign:"center"}}>🚛</div>}
        </div>

        <nav style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
          {NAV.map(n=>(
            <div key={n.id} onClick={()=>{setPage(n.id);setPageAction(null)}}
              style={{
                display:"flex",alignItems:"center",gap:12,padding:"11px 16px",cursor:"pointer",
                background:page===n.id?"rgba(255,255,255,0.12)":"transparent",
                borderLeft:page===n.id?"3px solid #4fc3f7":"3px solid transparent",
                transition:"all .15s",
              }}
              onMouseOver={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}
              onMouseOut={e=>e.currentTarget.style.background=page===n.id?"rgba(255,255,255,0.12)":"transparent"}
            >
              <span style={{fontSize:16,minWidth:20,textAlign:"center"}}>{n.icon}</span>
              {sidebarOpen&&<span style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",
                color:page===n.id?"#fff":"rgba(255,255,255,0.75)"}}>{n.label}</span>}
            </div>
          ))}
        </nav>

        <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
          <div onClick={async () => {
          await signOut(auth);
          setFirebaseUser(null);
          setLoggedIn(false);
          setEmail("");
          setPass("");
          setPassErr(false);
          setPage("dashboard");
            }}
            style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",
              color:"rgba(255,255,255,0.6)",fontSize:13}}>
            <span>🚪</span>{sidebarOpen&&"Logout"}
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* TOPBAR */}
        <div style={{background:"#fff",borderBottom:"1px solid #eee",padding:"0 24px",
          height:56,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <button onClick={()=>setSidebarOpen(p=>!p)}
            style={{border:"none",background:"none",cursor:"pointer",fontSize:20,padding:"4px 8px"}}>
            ☰
          </button>
          <div style={{fontSize:13,color:"#888"}}>
            {getMonthLabel(selectedMonth)} · Admin
          </div>
        </div>

        {/* PAGE */}
        <div style={{flex:1,overflowY:"auto",padding:"24px"}}>
          {page==="dashboard"&&<Dashboard data={data} selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth} navigate={navigate} />}
          {page==="trips"&&<TripsPage data={data} update={update} navigate={navigate} openAdd={pageAction==="add"} />}
          {page==="parties"&&<PartiesPage data={data} update={update} />}
          {page==="transporters"&&<TransportersPage data={data} update={update} />}
          {page==="cashbook"&&<CashbookPage data={data} update={update} openAdd={pageAction==="add"} />}
          {page==="payments"&&<PaymentsPage data={data} update={update} />}
          {page==="pending"&&<PendingPage data={data} update={update} />}
          {page==="invoices"&&<InvoicePage data={data} update={update} />}
          {page==="trucks"&&<TrucksPage data={data} update={update} />}
          {page==="drivers"&&<DriversPage data={data} update={update} />}
          {page==="reports"&&<ReportsPage data={data} />}
          {page==="settings"&&<SettingsPage data={data} update={update} />}
          {page==="generalExpenses"&&<GeneralExpensesPage data={data} update={update} />}
          {page==="staffSalaries"&&<StaffSalariesPage data={data} update={update} />}
          {page==="ownerDrawings"&&<OwnerDrawingsPage data={data} update={update} />}
        </div>
      </div>
    </div>
  );
}