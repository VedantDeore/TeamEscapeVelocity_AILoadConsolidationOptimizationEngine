# 🚚 LORRI — AI Load Consolidation Optimization Engine

Lorri is an **AI-powered logistics optimization engine** that intelligently consolidates shipments, maximizes vehicle capacity, and reduces transportation costs and carbon emissions.

It combines **machine learning clustering, vehicle routing optimization, and 3D bin packing visualization** with an **AI logistics co-pilot** that managers can interact with using natural language.

Built as a **hackathon prototype**, Lorri demonstrates how modern AI systems can dramatically improve logistics efficiency using **open-source technologies**.

---

# ✨ Features

### 📦 Intelligent Shipment Consolidation
Lorri uses **machine learning clustering algorithms** to automatically group nearby shipments that can be transported together, increasing vehicle utilization.

### 🚛 Vehicle Capacity Optimization
Using **Google OR-Tools bin packing algorithms**, Lorri finds the best way to fill trucks and containers, minimizing unused space.

### 🧭 Route Optimization
Lorri solves the **Vehicle Routing Problem (VRP)** to determine the most efficient delivery routes.

### 📊 Logistics Insights Dashboard
Interactive analytics showing:

- Vehicle utilization
- Cost savings
- Load comparison
- Carbon emission reduction

### 🗺 Interactive Logistics Map
Shipments and optimized routes are visualized using **OpenStreetMap** with interactive mapping.

### 📦 3D Load Visualization (USP)
Lorri renders a **3D simulation of truck/container loading**, helping managers understand how shipments fit into a vehicle.

### 🤖 AI Logistics Co-Pilot
Managers can ask questions such as:

> "Which shipments can be consolidated today?"  
> "How much cost can we save by combining loads?"  
> "Show me underutilized trucks."

The AI agent uses **LLM reasoning + logistics data** to generate insights.

### 🌱 Carbon Emission Tracking
Lorri estimates emissions based on **distance × load factor**, helping logistics companies measure sustainability improvements.

---
# 🏗 System Architecture

Frontend (Next.js)
│
├── Dashboard UI
├── Maps Visualization
├── 3D Truck Loading
│
▼
Backend API (Flask)

├── Shipment Clustering (DBSCAN)
├── Vehicle Routing Optimization (OR-Tools VRP)
├── Capacity Optimization (Bin Packing)
├── Distance Calculation
│
▼
Database (Supabase)

│
▼
AI Co-Pilot (LLM)


---

# ⚙️ Tech Stack

## Frontend

| Technology | Purpose |
|---|---|
| Next.js 14 | Frontend framework |
| Tailwind CSS + shadcn/ui | Modern UI components |
| Recharts | Analytics and charts |
| Leaflet + React-Leaflet | Interactive maps |
| Three.js / React-Three-Fiber | 3D truck loading visualization |
| Framer Motion | UI animations |
| Supabase JS Client | Authentication and realtime data |

---

## Backend

| Technology | Purpose |
|---|---|
| Flask | REST API server |
| Flask-CORS | Cross-origin API support |
| Google OR-Tools | Vehicle routing + bin packing optimization |
| scikit-learn | Shipment clustering |
| pandas + numpy | Data processing |
| scipy.optimize | Mathematical optimization |
| geopy | Distance calculation |
| openrouteservice | Route optimization API |
| py3dbp | 3D bin packing algorithm |

---

## AI / Machine Learning

| Component | Tool |
|---|---|
| Shipment Clustering | DBSCAN (scikit-learn) |
| Capacity Optimization | Google OR-Tools |
| Route Optimization | OR-Tools VRP |
| Natural Language Agent | Mixtral-8x7B / Groq |
| Carbon Estimation | Custom emission formula |
| Pattern Learning | Feedback-based optimization |

---

# 🧠 How Lorri Works

### 1️⃣ Shipment Data Ingestion
Shipment data is uploaded with:

- pickup location
- delivery location
- weight
- dimensions
- delivery deadline

---

### 2️⃣ Clustering
Lorri uses **DBSCAN clustering** to group shipments that are geographically close.

This automatically identifies **consolidation opportunities**.

---

### 3️⃣ Capacity Optimization
A **bin packing algorithm** determines how shipments fit into vehicles.

Goal:

- maximize utilization
- minimize empty space

---

### 4️⃣ Route Optimization
Lorri solves the **Vehicle Routing Problem (VRP)** to generate optimal routes.

This minimizes:

- distance
- delivery time
- fuel cost

---

### 5️⃣ 3D Load Simulation
Shipments are visualized inside trucks using **3D bin packing visualization**.

This helps planners validate the loading plan.

---

### 6️⃣ AI Logistics Copilot

Example interaction:

---

# 📊 Expected Impact

| Metric | Improvement |
|---|---|
| Vehicle Utilization | +30–40% |
| Logistics Cost | −20–30% |
| Empty Miles | −35% |
| Carbon Emissions | −25% |



