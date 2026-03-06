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

# 🏗 System Architecture
