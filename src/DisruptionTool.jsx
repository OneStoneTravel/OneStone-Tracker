import { useState } from "react";

const DATA = {
  flight: [
    { t: "Flight on time / no issue", s: "Nothing needed", dot: "ok",
      a: [{ l: "green", t: "No action — but confirm you're monitoring", d: "Let the traveler know you're watching the itinerary. That single message is a big part of what they're paying for." }],
      say: "Just confirming you're all set for the 4:15 — I've got eyes on it and I'll reach out first if anything changes." },
    { t: "Flight delayed — connection still makeable", s: "Delay under the connection buffer", dot: "warn",
      a: [
        { l: "green", t: "Monitor and pre-search a backup", d: "Don't rebook yet. Quietly identify the next two options so you can move instantly if it slips further." },
        { l: "amber", t: "Tell the traveler you're watching it", d: "Proactive contact prevents a panicked call later. Keep it brief and calm." },
        { l: "red", t: "Don't rebook prematurely", d: "Rebooking early can forfeit the original seat and may trigger fare differences for a delay that resolves itself." },
      ],
      say: "Your inbound is running about 40 minutes late but you've still got a 1:15 connection window — that holds. I'm watching it and I already have two backups lined up if it slips. You don't need to do anything." },
    { t: "Flight delayed — connection WILL be missed", s: "Act before the plane lands", dot: "bad",
      a: [
        { l: "green", t: "Rebook the connection NOW — before landing", d: "The moment that plane lands, 180 people start rebooking. Seats on the next flight disappear in minutes. Beat the crowd — this is the single highest-value thing you'll do all night." },
        { l: "green", t: "Check other carriers in the same alliance", d: "If the original airline's next option is poor, a partner airline may have earlier seats." },
        { l: "amber", t: "Hold a hotel room, don't book yet", d: "If an overnight looks likely, place a hold you can cancel free. Confirm only once the overnight is certain." },
      ],
      say: "Your connection isn't going to work — I'm rebooking you now, before you land, so we get ahead of everyone else on that plane. Two options: 6:10am arriving 9:35, or a red-eye through Denver landing 1:40am. Which do you want?",
      flag: "Speed matters more here than anywhere else in this tool. Rebook first, explain second." },
    { t: "Flight cancelled — same-day options exist", s: "Get them out today", dot: "warn",
      a: [
        { l: "green", t: "Offer exactly two options with a clear tradeoff", d: "Earliest arrival vs. best sleep. Two choices decide fast; five choices paralyze a tired traveler." },
        { l: "green", t: "Ask the airline if it's within their control", d: "Mechanical or crew = airline often owes meals/hotel. Weather = generally not. Log the agent's name." },
        { l: "amber", t: "Consider a nearby airport", d: "Flying into a secondary airport plus a rideshare often beats waiting hours. Confirm ground transport exists at that hour first." },
        { l: "red", t: "Don't accept the airline's default rebooking without checking", d: "Their automatic rebook is frequently the worst available option — sometimes days out." },
      ],
      say: "That flight's cancelled but I've got you covered. Two choices: there's a 7:40 tonight that gets you in at 11pm, or a 6:10am that gets you in by 9:30 fresh. Which works better for your morning?" },
    { t: "Cancelled — stranded overnight", s: "Bed first, then rebooking", dot: "bad",
      a: [
        { l: "green", t: "Book the hotel immediately (under $400 = no approval needed)", d: "Get them off the concourse. Near the airport, with a shuttle. Send the confirmation before you do anything else." },
        { l: "green", t: "Rebook the morning flight and fix everything downstream", d: "Cancel tonight's destination hotel so they're not double-charged. Push the rental car pickup. Adjust the return leg if needed." },
        { l: "green", t: "Push the airline for a hotel voucher first", d: "If it's mechanical or crew, ask directly. Most travelers never do. Free money for the client." },
        { l: "amber", t: "Notify their office contact", d: "Only if their profile authorizes it. Saves the traveler an awkward morning conversation." },
      ],
      say: "Alright — you're not sleeping in that terminal. I'm booking you at the Hyatt across from Terminal C right now, that'll go on the company card same as your flight. Confirmation's hitting your phone in two minutes. Then I'll put you on the 6:10 and cancel tonight's Denver hotel so you're not paying for a room you never used.",
      flag: "Book the room BEFORE you finish sorting the flight. A traveler with a confirmed bed is a calm traveler." },
    { t: "Stuck at a hub — no flights until tomorrow afternoon", s: "e.g. DFW at 11pm, nothing to Austin/Houston/OKC until 2pm", dot: "bad",
      a: [
        { l: "green", t: "Check the drive — this is the move most people miss", d: "From DFW: Austin, Houston, OKC, and Shreveport are all roughly 3–4 hours. A one-way rental gets them there overnight or first thing, instead of losing an entire business day. Use the Drive vs. Fly tab." },
        { l: "green", t: "If driving, book the one-way rental AND the hotel option", d: "Give them both: 'drive tonight and sleep in your own bed' or 'sleep here and drive at 6am rested.' Let them choose." },
        { l: "amber", t: "Check nearby airports for earlier departures", d: "Love Field (DAL) may have earlier seats than DFW. Confirm the transfer is realistic at that hour." },
        { l: "red", t: "Never push a long drive on an exhausted traveler", d: "If they've been up since 4am, a 4-hour night drive is a genuine safety risk. Offer it; let THEM decide. If they hesitate at all, book the hotel and drive in the morning." },
      ],
      say: "Nothing's flying to Austin until 2pm tomorrow, which costs you the whole morning. But here's the thing — Austin is a three-hour drive from here. I can have a one-way rental waiting for you in 20 minutes and you'd be home by 2am, or I can put you in a hotel here and you drive at 6am rested. Which sounds better to you?",
      flag: "SAFETY: never recommend a night drive to someone who sounds exhausted. Offer both options and take their answer at face value." },
    { t: "Bumped / denied boarding (overbooked)", s: "Involuntary denied boarding", dot: "bad",
      a: [
        { l: "green", t: "Get them rebooked and get the compensation", d: "Involuntary denied boarding on a US flight generally carries required compensation. Make sure the airline processes it — many travelers walk away without asking." },
        { l: "green", t: "Get it in writing before leaving the gate", d: "Compensation form or written confirmation. Much harder to claim later." },
        { l: "amber", t: "Voluntary bump — only if it doesn't break the trip", d: "If the traveler is offered a voucher to take a later flight, that's their call, not yours. Flag any impact on their meeting." },
      ],
      say: "They've bumped you, which means they owe you compensation — don't leave that gate without it in writing. Meanwhile I've already got you on the 8:20 and I'm adjusting your hotel check-in." },
    { t: "Seat / class not as booked", s: "Downgrade, seat change, no upgrade honored", dot: "warn",
      a: [
        { l: "green", t: "Push the airline at the gate first", d: "Gate agents can often fix seating on the spot. Faster than any back-end change." },
        { l: "amber", t: "Pay to fix it if it's within their travel policy", d: "Check the client's policy and spend threshold before buying a seat upgrade." },
        { l: "green", t: "Document for a refund claim on a paid downgrade", d: "If they paid for premium and flew economy, that's a refundable fare difference. Log it and chase it after the trip." },
      ],
      say: "That's not what we booked — let me work it. Ask the gate agent for the row you were assigned while I get on with the airline on my end. If we can't fix it today, I'll file for the fare difference back." },
  ],
  hotel: [
    { t: "Hotel is fine / traveler happy", s: "No action", dot: "ok",
      a: [{ l: "green", t: "Log the property as a good option", d: "Note it in the client profile so you book it again next time they're in that city. This is how you build 'they know us' service." }],
      say: "" },
    { t: "Hotel oversold — traveler is being walked", s: "They arrive and there's no room", dot: "bad",
      a: [
        { l: "green", t: "Make the hotel do the walking properly", d: "An oversold property is generally expected to arrange comparable accommodation nearby and cover the transfer. Insist before you spend the client's money." },
        { l: "green", t: "Book a backup yourself in parallel", d: "Don't wait on the front desk. Secure a room at a nearby comparable property while you're arguing — cancel whichever you don't use." },
        { l: "amber", t: "Upgrade the standard if nothing comparable exists", d: "Late at night, a pricier room beats no room. Under $400 just do it; document why." },
        { l: "red", t: "Don't let the traveler negotiate at the desk", d: "That's our job. A tired traveler arguing at midnight is exactly the experience they hired us to avoid." },
      ],
      say: "Don't argue with them — hand the phone to the front desk or just step aside and let me handle it. They're supposed to place you at a comparable property and cover the ride. I'm also holding a room at the Marriott two blocks over as a backup so you're sleeping within the hour either way." },
    { t: "Room not as booked", s: "Wrong bed type, smoking, no accessibility", dot: "warn",
      a: [
        { l: "green", t: "Call the property directly and fix it", d: "Almost always solvable on the spot. Accessibility issues are a hard requirement — escalate immediately if not met." },
        { l: "amber", t: "Move properties if it can't be resolved", d: "Rebook nearby, cancel the original, and pursue a refund." },
        { l: "green", t: "Note the preference permanently", d: "Add it to the traveler profile so it never happens twice." },
      ],
      say: "That's not what we reserved. Give me five minutes with the front desk — I'll get you into the right room. If they can't sort it, I'll move you somewhere that can." },
    { t: "Traveler dislikes the property", s: "Not broken, just not acceptable to them", dot: "warn",
      a: [
        { l: "amber", t: "Ask what specifically is wrong before moving", d: "Noise, cleanliness, and safety are legitimate and worth a move. General preference is a conversation about policy and cost." },
        { l: "amber", t: "Check policy and cost before rebooking", d: "A move mid-stay may mean paying for both. If it exceeds their threshold, get approval." },
        { l: "green", t: "Always log it for next time", d: "Even if you don't move them tonight, never book that property for them again." },
        { l: "red", t: "Don't move them on preference alone without approval", d: "If it's above the spend threshold and the room is objectively fine, the approver decides — not us." },
      ],
      say: "Tell me what's wrong with it specifically — if it's noise or cleanliness or you don't feel safe, I'm moving you right now. If it's more that it's just not your kind of place, I can move you but there may be a charge, so let me check with Sarah first. Either way I'm noting never to book this one for you again." },
    { t: "Safety concern at the property", s: "Traveler feels unsafe", dot: "bad",
      a: [
        { l: "green", t: "Move them immediately. No approval needed.", d: "Safety overrides every spend rule in the system. Book first, document after, explain to the client tomorrow." },
        { l: "green", t: "Notify the client's contact same night", d: "They need to know, and they will back the decision." },
      ],
      say: "You're not staying there. I'm moving you right now — give me ten minutes. Don't worry about the cost, that's my problem to sort out tomorrow.",
      flag: "This is the one scenario where you never pause for authorization. Move them." },
  ],
  car: [
    { t: "Rental was fine", s: "No action", dot: "ok",
      a: [{ l: "green", t: "Log the location and supplier", d: "Note it so you rebook the same reliable branch next time." }], say: "" },
    { t: "Wrong car class delivered", s: "Booked mid-size, given compact", dot: "warn",
      a: [
        { l: "green", t: "Push for the class booked or a free upgrade", d: "If they can't supply the class reserved, an upgrade at no charge is the standard remedy. Ask plainly." },
        { l: "amber", t: "Accept a smaller car only if it genuinely works", d: "Check the traveler count and luggage first. Three people and golf clubs don't fit in a compact." },
        { l: "green", t: "Claim the rate difference afterward", d: "If they paid mid-size and drove compact, that difference is recoverable. Log it." },
      ],
      say: "They owe you at minimum the class you reserved — ask for the manager and tell them the reservation was confirmed for a mid-size. If they've genuinely got nothing, I'll claim the difference back for you after the trip." },
    { t: "No cars available despite a confirmed reservation", s: "The counter says they're out", dot: "bad",
      a: [
        { l: "green", t: "Check the other counters in the same terminal first", d: "Fastest fix by far. Book a competitor directly while the traveler is standing there, then cancel the original." },
        { l: "green", t: "Make the original supplier cover the difference", d: "A confirmed reservation they can't honor usually means they cover a comparable rental elsewhere. Ask before paying out of pocket." },
        { l: "amber", t: "Consider rideshare instead for short trips", d: "If it's a two-day trip with one meeting, rideshare may be cheaper and simpler than chasing a car." },
        { l: "amber", t: "Check off-airport branches", d: "Often have stock when airport counters are cleaned out. Factor the shuttle time." },
      ],
      say: "Stay right there — don't get in another line. I'm checking Hertz and National in the same terminal now and I'll have you in a car in ten minutes. I'm also going to make Avis cover any difference since they couldn't honor a confirmed booking." },
    { t: "Vehicle breakdown or accident", s: "Mid-trip vehicle failure", dot: "bad",
      a: [
        { l: "green", t: "Safety and the rental company's roadside first", d: "Confirm they're safe and out of traffic. The rental company's roadside line is the fastest path — you handle everything after that." },
        { l: "green", t: "Arrange the replacement while roadside is en route", d: "Don't wait for the tow to finish before sorting the next car." },
        { l: "green", t: "Notify the client contact if it affects their schedule", d: "Meetings may need moving. Get ahead of it." },
      ],
      say: "First — are you somewhere safe, off the road? Good. Call the number on the key fob for roadside, that's the fastest way to get you towed. While you're doing that I'm arranging a replacement car and I'll text you where to pick it up." },
  ],
  other: [
    { t: "Baggage delayed or lost", s: "Bag didn't arrive", dot: "warn",
      a: [
        { l: "green", t: "File the claim before they leave the airport", d: "Much harder to file afterward. Get the file reference number and log it." },
        { l: "green", t: "Check the airline's interim expense allowance", d: "Many carriers reimburse essentials on a delayed bag. Most travelers don't know to ask." },
        { l: "amber", t: "Authorize essentials purchase", d: "Toiletries and a shirt for tomorrow's meeting. Usually well under the $400 threshold — just approve it." },
      ],
      say: "Don't leave the airport without filing the claim and getting the file number — text it to me. Then go buy whatever you need for tomorrow morning, that's covered, and I'll handle getting it reimbursed." },
    { t: "Traveler will miss their meeting", s: "Disruption breaks the purpose of the trip", dot: "bad",
      a: [
        { l: "green", t: "Ask whether the trip still makes sense", d: "Sometimes the right answer is going home. Raise it — the traveler often won't." },
        { l: "green", t: "Offer to notify the meeting host", d: "A call from the travel manager reads as professional, not as an excuse." },
        { l: "amber", t: "Price the aggressive option anyway", d: "Charter, alternate airport, or a long drive. Present the cost and let the client decide if the meeting justifies it." },
      ],
      say: "Realistically you're not making the 9am. Before I rebook — is this trip still worth taking, or do you want me to get you home instead? And if it helps, I'm glad to call their office and explain it came from the airline's end, not yours." },
    { t: "Medical issue or emergency", s: "Traveler is unwell or injured", dot: "bad",
      a: [
        { l: "green", t: "Emergency services first. Logistics second.", d: "Direct them to local emergency care. Everything else waits." },
        { l: "green", t: "Notify their emergency contact and company contact immediately", d: "Do not wait until morning." },
        { l: "green", t: "Then handle travel — no spend limits apply", d: "Get them home or get family to them. Document and explain afterward." },
      ],
      say: "Stop worrying about the trip — that's mine now. Get to care first. I'm calling your office and your emergency contact, and I'll sort your flights once I know you're okay.",
      flag: "No approval thresholds apply in a medical situation. Act, then document." },
    { t: "Mass disruption — storm, ground stop, system outage", s: "Everything is cancelled at once", dot: "bad",
      a: [
        { l: "green", t: "Triage by deadline, not by who called first", d: "Whoever has the earliest hard commitment gets rebooked first. Message everyone else immediately so they know they're in the queue." },
        { l: "green", t: "Book hotels early — they sell out fast", d: "In a mass event, rooms near the airport disappear within an hour. Move before travelers even ask." },
        { l: "green", t: "Send one proactive update to every affected client", d: "A single 'we're on it, here's the situation' message prevents dozens of panicked calls." },
        { l: "amber", t: "Ground alternatives become the edge", d: "When everyone is fighting for the same seats, rental cars and rail are the way out. Check the Drive vs. Fly tab early." },
        { l: "red", t: "Don't promise timelines you can't control", d: "Say what you're doing, not when it'll be resolved." },
      ],
      say: "There's a ground stop across the whole system — I'm working every one of your travelers right now, starting with whoever has the earliest commitment. I'm also locking down hotel rooms before they're gone. I'll update you within the hour whether or not I have answers.",
      flag: "In a mass event, hotels and rental cars run out before flights do. Move on those first." },
  ],
};

const DRIVE = {
  "JFK / LGA / EWR / New York": [["Philadelphia", 95, 2.0], ["Hartford CT", 120, 2.3], ["Albany", 155, 2.8], ["Baltimore", 190, 3.5], ["Boston", 215, 4.0], ["Washington DC", 230, 4.3]],
  "LAS / Las Vegas": [["St. George UT", 120, 2.0], ["Barstow CA", 155, 2.3], ["Flagstaff", 250, 4.0], ["Los Angeles", 270, 4.2], ["Phoenix", 300, 4.7]],
  "MCO / Orlando": [["Daytona Beach", 55, 1.0], ["Tampa", 85, 1.5], ["Jacksonville", 140, 2.3], ["Fort Myers", 165, 2.8], ["Miami", 235, 3.7]],
  "MIA / Fort Lauderdale": [["Fort Lauderdale", 30, 0.7], ["West Palm Beach", 70, 1.3], ["Naples", 125, 2.2], ["Fort Myers", 155, 2.7], ["Orlando", 235, 3.7]],
  "BOS / Boston": [["Providence", 50, 1.0], ["Hartford CT", 100, 1.8], ["Portland ME", 110, 2.0], ["Albany", 170, 2.8], ["New York City", 215, 4.0]],
  "SFO / San Francisco": [["Oakland", 20, 0.5], ["San Jose", 45, 1.0], ["Sacramento", 90, 1.7], ["Monterey", 120, 2.2], ["Fresno", 190, 3.2]],
  "DCA / IAD / BWI / Washington": [["Baltimore", 40, 1.0], ["Richmond", 110, 2.0], ["Philadelphia", 140, 2.7], ["Norfolk", 190, 3.3], ["New York City", 230, 4.3]],
  "SAN / San Diego": [["Orange County", 90, 1.5], ["Los Angeles", 120, 2.0], ["Palm Springs", 140, 2.3], ["Phoenix", 355, 5.3]],
  "AUS / Austin": [["San Antonio", 80, 1.3], ["Waco", 100, 1.7], ["Houston", 165, 2.7], ["Dallas", 195, 3.2]],
  "STL / St. Louis": [["Springfield IL", 100, 1.7], ["Columbia MO", 125, 2.0], ["Kansas City", 250, 3.7], ["Indianapolis", 245, 3.7], ["Memphis", 285, 4.3]],
  "MCI / Kansas City": [["Topeka", 70, 1.2], ["St. Joseph", 55, 1.0], ["Omaha", 185, 3.0], ["Des Moines", 195, 3.0], ["Wichita", 200, 3.0]],
  "CLE / Cleveland": [["Akron", 40, 0.8], ["Toledo", 115, 2.0], ["Pittsburgh", 135, 2.2], ["Columbus", 145, 2.3], ["Detroit", 170, 2.7]],
  "PIT / Pittsburgh": [["Morgantown WV", 75, 1.3], ["Cleveland", 135, 2.2], ["Columbus", 185, 3.0], ["Philadelphia", 305, 4.7]],
  "TPA / Tampa": [["Sarasota", 60, 1.0], ["Orlando", 85, 1.5], ["Fort Myers", 125, 2.2], ["Jacksonville", 200, 3.2], ["Miami", 280, 4.2]],
  "PDX / Portland": [["Salem", 45, 0.8], ["Eugene", 110, 1.8], ["Seattle", 175, 3.0], ["Bend", 160, 3.0]],
  "IND / Indianapolis": [["Cincinnati", 110, 1.8], ["Louisville", 115, 1.8], ["Columbus", 175, 2.8], ["Chicago", 185, 3.0], ["St. Louis", 245, 3.7]],
  "RDU / Raleigh-Durham": [["Greensboro", 80, 1.3], ["Charlotte", 165, 2.5], ["Richmond", 170, 2.7], ["Norfolk", 200, 3.3]],
  "CVG / Cincinnati": [["Louisville", 100, 1.7], ["Indianapolis", 110, 1.8], ["Columbus", 110, 1.8], ["Lexington", 85, 1.3]],
  "MEM / Memphis": [["Little Rock", 140, 2.2], ["Nashville", 210, 3.3], ["Jackson MS", 210, 3.3], ["St. Louis", 285, 4.3]],
  "SAT / San Antonio": [["Austin", 80, 1.3], ["Corpus Christi", 145, 2.3], ["Houston", 200, 3.2], ["Dallas", 275, 4.5]],
  "MSY / New Orleans": [["Baton Rouge", 80, 1.3], ["Gulfport MS", 70, 1.2], ["Mobile", 145, 2.3], ["Houston", 350, 5.3]],
  "CMH / Columbus": [["Dayton", 75, 1.2], ["Cincinnati", 110, 1.8], ["Cleveland", 145, 2.3], ["Indianapolis", 175, 2.8]],
  "MKE / Milwaukee": [["Madison", 80, 1.3], ["Chicago", 90, 1.5], ["Green Bay", 120, 2.0]],
  "ABQ / Albuquerque": [["Santa Fe", 65, 1.0], ["Las Cruces", 225, 3.3], ["El Paso", 270, 4.0], ["Flagstaff", 325, 4.7]],
  "BOI / Boise": [["Twin Falls", 130, 2.0], ["Ontario OR", 60, 1.0], ["Salt Lake City", 340, 5.0]],
  "OMA / Omaha": [["Lincoln", 60, 1.0], ["Des Moines", 135, 2.2], ["Kansas City", 185, 3.0], ["Sioux Falls", 180, 2.8]],
  "DFW / Dallas": [["Oklahoma City", 205, 3.2], ["Austin", 195, 3.2], ["Shreveport", 190, 3.0], ["Houston", 240, 3.7], ["Tulsa", 260, 4.0], ["San Antonio", 275, 4.5], ["Little Rock", 320, 5.0]],
  "IAH / Houston": [["Austin", 165, 2.7], ["San Antonio", 200, 3.2], ["Dallas", 240, 3.7], ["Baton Rouge", 270, 4.2], ["New Orleans", 350, 5.3]],
  "ATL / Atlanta": [["Chattanooga", 120, 2.0], ["Birmingham", 150, 2.5], ["Augusta", 145, 2.3], ["Nashville", 250, 4.0], ["Charlotte", 245, 4.0]],
  "ORD / Chicago": [["Milwaukee", 90, 1.5], ["Madison", 150, 2.5], ["Indianapolis", 185, 3.0], ["St. Louis", 300, 4.5], ["Detroit", 280, 4.5]],
  "DEN / Denver": [["Fort Collins", 65, 1.0], ["Colorado Springs", 70, 1.2], ["Cheyenne", 100, 1.7], ["Grand Junction", 250, 4.0]],
  "PHX / Phoenix": [["Tucson", 115, 2.0], ["Flagstaff", 145, 2.3], ["Sedona", 115, 2.0], ["Las Vegas", 300, 4.7]],
  "CLT / Charlotte": [["Greensboro", 95, 1.5], ["Columbia", 95, 1.5], ["Asheville", 130, 2.2], ["Raleigh", 165, 2.5]],
  "LAX / Los Angeles": [["Santa Barbara", 95, 1.7], ["San Diego", 120, 2.0], ["Bakersfield", 110, 2.0], ["Palm Springs", 110, 2.0], ["Las Vegas", 270, 4.2]],
  "BNA / Nashville": [["Huntsville", 110, 1.8], ["Chattanooga", 135, 2.0], ["Louisville", 175, 2.7], ["Memphis", 210, 3.3]],
  "MSP / Minneapolis": [["Rochester MN", 90, 1.5], ["Duluth", 155, 2.5], ["Des Moines", 245, 3.5]],
  "SEA / Seattle": [["Tacoma", 35, 0.7], ["Vancouver BC", 140, 2.5], ["Portland", 175, 3.0], ["Spokane", 280, 4.5]],
  "PHL / Philadelphia": [["New York City", 95, 2.0], ["Baltimore", 100, 2.0], ["Washington DC", 140, 2.7]],
  "DTW / Detroit": [["Toledo", 60, 1.0], ["Grand Rapids", 155, 2.5], ["Cleveland", 170, 2.7]],
  "SLC / Salt Lake City": [["Provo", 45, 0.8], ["Ogden", 40, 0.7], ["Park City", 35, 0.7], ["Boise", 340, 5.0]],
};

function verdict(h) {
  if (h <= 3.5) return ["go", "Drive — beats waiting"];
  if (h <= 4.5) return ["maybe", "Offer it, check fatigue"];
  return ["no", "Only if no flight tomorrow"];
}

function DriveVsFly() {
  const hubs = Object.keys(DRIVE).sort();
  const [hub, setHub] = useState(hubs[0]);
  const rows = DRIVE[hub] || [];

  return (
    <>
      <div className="rule-card">
        <h3>The rule of thumb</h3>
        <p>If the drive is <b>under about 3.5 hours</b> and the next flight is tomorrow, driving usually wins — they get there tonight or early morning instead of losing a business day.</p>
        <ul>
          <li>Book a <b>one-way rental</b> and cancel or refund the flight on the back end.</li>
          <li>Always offer both: <b>drive tonight</b>, or <b>hotel now and drive rested at 6am</b>.</li>
          <li><b>Never push a night drive on an exhausted traveler.</b> Offer it; take hesitation as a no.</li>
          <li>Check one-way drop fees and whether the counter is open at that hour.</li>
        </ul>
      </div>
      <div className="drive-pick">
        <select value={hub} onChange={(e) => setHub(e.target.value)}>
          {hubs.map((h) => <option key={h}>{h}</option>)}
        </select>
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>Pick the airport they're stuck at</span>
      </div>
      <div className="tbl-wrap">
        <table className="k">
          <thead><tr><th>Destination</th><th>Miles</th><th>Drive time</th><th>Verdict</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const v = verdict(r[2]);
              return (
                <tr key={r[0]}>
                  <td><b>{r[0]}</b></td>
                  <td>{r[1]} mi</td>
                  <td>{r[2].toFixed(1)} hrs</td>
                  <td><span className={`verdict ${v[0]}`}>{v[1]}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Scenario({ s }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`scenario ${open ? "open" : ""}`}>
      <div className="sc-head" onClick={() => setOpen(!open)}>
        <span className={`sc-dot ${s.dot}`} />
        <div className="sc-title">{s.t}<div className="sc-sub">{s.s}</div></div>
        <span className="chev">▶</span>
      </div>
      {open && (
        <div className="sc-body">
          <div className="actions">
            {s.a.map((a, i) => (
              <div className={`act ${a.l}`} key={i}>
                <div className="lvl">{a.l === "green" ? "Recommend" : a.l === "amber" ? "Caution" : "Avoid"}</div>
                <div className="at">{a.t}</div>
                <div className="ad">{a.d}</div>
              </div>
            ))}
          </div>
          {s.say && <div className="say"><div className="lbl">Say something like</div><div className="txt">{s.say}</div></div>}
          {s.flag && <div className="flag">{s.flag}</div>}
        </div>
      )}
    </div>
  );
}

export default function DisruptionTool() {
  const [activeCat, setActiveCat] = useState("flight");
  const [query, setQuery] = useState("");

  const tabs = [
    { cat: "flight", label: "Flight" },
    { cat: "hotel", label: "Hotel" },
    { cat: "car", label: "Rental Car" },
    { cat: "other", label: "Other" },
    { cat: "drive", label: "Drive vs. Fly" },
  ];

  const list = activeCat === "drive" ? [] : (DATA[activeCat] || []).filter((s) => {
    if (!query) return true;
    const hay = (s.t + " " + s.s + " " + s.a.map((a) => a.t + " " + a.d).join(" ")).toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  function handleSearch(v) {
    setQuery(v);
    if (v && activeCat === "drive") setActiveCat("flight");
  }

  return (
    <div>
      <div className="welcome">
        <div>
          <h1>Disruption Decision Support</h1>
          <p>Pick what went wrong. Green = recommend. Amber = flag the tradeoff. Red = avoid.</p>
        </div>
      </div>

      <div className="searchbar">
        <input
          type="text"
          placeholder="Search a situation — 'oversold', 'cancelled', 'wrong car'…"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <div className="dtabs">
        {tabs.map((tb) => (
          <div
            key={tb.cat}
            className={`dtab ${activeCat === tb.cat ? "active" : ""}`}
            onClick={() => setActiveCat(tb.cat)}
          >
            {tb.label}
          </div>
        ))}
      </div>

      {activeCat === "drive" ? (
        <DriveVsFly />
      ) : list.length === 0 ? (
        <div className="empty">No matching situations. Try another word or tab.</div>
      ) : (
        list.map((s, i) => <Scenario s={s} key={i} />)
      )}

      <div className="foot">
        Drive times are approximate — confirm in Maps before recommending.<br />
        Spend rules: under $400 just book it. Over $1,200 get approval first.
      </div>
    </div>
  );
}
