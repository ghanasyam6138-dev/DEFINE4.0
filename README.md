# DEFINE 4.0

The official project submission repository for **DEFINE 4.0 — The World's Realest Hackathon**.

---

# < Project Name >

<!-- Add your project cover image below -->

![Project Cover](./assets/cover.png)

## Team Information

- **fsociety**:
- **Software**:

## Team Members

| Name | Role | GitHub | LinkedIn |
|------|------|--------|----------|
| Ghanasyam S | Role | https://github.com/ghanasyam6138-dev | www.linkedin.com/in/ghanasyams |
| Maria Teresa Thomas | Role | https://github.com/mariateresathomas | www.linkedin.com/in/mariateresathomas |
| Joshua S Robin | Role | https://github.com/Joshua-S-Robin | https://www.linkedin.com/in/joshua-s-robin/ |
| Adith K | Role | https://github.com/adithk7 | https://www.linkedin.com/in/adith-k-1a2092368/ |
| Nandita M Menon | Role | https://github.com/nandita-mm | https://www.linkedin.com/in/nandita-m-menon?utm_source=share_via&utm_content=profile&utm_medium=member_android |

---

# Project Details

## Overview

The Smart Parking & Venue Operations project is a unified software platform that integrates with existing venue hardware to manage both transient and recurring parking sites through a single operator-owned system. It addresses the frustrations of circling for spaces, exit gate queues, and blocked vehicles by providing live space allocation, automated payment processing, and a privacy-preserving driver contact relay. Using a combined edge-box and cloud architecture, the platform delivers a seamless, web app experience for drivers while ensuring venues retain full control of their data and operations.

## Problem Statement

Malls and busy venues lose time and goodwill in their parking areas. Drivers circle looking for space, staff are deployed by guesswork, cars get blocked in, and exits queue at the toll gate. Build a parking platform with two sides. Drivers should be able to find parking or reserve a preferred zone in advance, be guided to an assigned slot on arrival, add services such as a car wash during the visit, track the running parking fee and pay before reaching the exit. The venue operator (for example, a large mall) needs a live operations view of occupancy, arrivals and how long cars stay, with insights for deploying staff, routing incoming traffic and planning for peak days. Also tackle everyday problems such as a car blocking another, where management today resorts to public announcements: give them a way to reach the driver directly without exposing anyone's phone number.

Explain:

- What is the problem?
The core problem is an inefficient parking experience marked by drivers circling for spaces, exit gate bottlenecks, unauthorized vehicles squatting in owned spots, and cars blocking one another. Additionally, venue management lacks real-time data to efficiently deploy staff or smoothly resolve these everyday parking conflicts.
- Who is affected by it?
This problem affects a wide range of drivers, including transient visitors at malls or airports, as well as recurring drivers like residents and daily employees. It also heavily impacts venue operators, security guards, and facility managers who are forced to manually manage gate queues, vehicle disputes, and visitor access.
- Why is solving it important?
Solving this is vital because it vastly improves the driver experience through automated entry, live slot guidance, and seamless exit payments without mandating an app download. Furthermore, a unified solution allows venue operators to retain complete ownership of sensitive data while ensuring that barriers remain safely operational even during network or power outages.
- What are the limitations of existing solutions?
Current parking systems force venues to surrender control of sensitive data to multiple third-party vendors. They also suffer from operational issues like double billing, fail during internet outages, and often require venues to install expensive new hardware. Ultimately, this creates a frustrating experience for drivers, who must juggle multiple apps, proprietary tags, or physical stickers just to manage their parking or resolve blocked-car issues.

## Solution

Explain your proposed solution and how it addresses the identified problem.
Describe the core idea, workflow, and key technologies used to build the solution.

Key TechnologiesEdge Processing & Vision: Local edge boxes run Python or Go services, utilizing MQTT brokers and SQLite caches for offline reliability. They employ YOLOv8/11 and OpenCV to process security camera feeds for real-time slot occupancy and plate recognition.Cloud Infrastructure: The single-tenant cloud core uses Postgres and TimescaleDB for persistent data storage, NATS for event streaming, and a dedicated constraint-scoring API for space allocation.Front-End Applications: The driver and staff interfaces are built as React/Next.js Progressive Web Apps (PWAs) connected via WebSockets to display live occupancy maps and alerts without requiring an app store download.Integrations & Privacy: The architecture leverages Exotel APIs for masked calling, external gateways for UPI/FASTag transactions, and an operator-managed Key Management Service (KMS) with HMAC-SHA256 encryption to securely tokenize personal license plate data.

---

# Demo

### Demo Video

[Watch Project Demo](https://www.youtube.com/watch?v=VIDEO_ID)

> Replace `VIDEO_ID` with your YouTube video ID.

### Screenshots

<!-- Add screenshots of your project here -->

![Screenshot 1](./assets/screenshot-1.png)

![Screenshot 2](./assets/screenshot-2.png)

![Screenshot 3](./assets/screenshot-3.png)

---

# Live Project

https://parksmart-demo-234.web.app/

---

# Technical Implementation

## Technologies Used

| Category | Technologies |
|----------|--------------|
| **Frontend** | Technologies |
| **Backend** | Technologies |
| **Database** | Technologies |
| **APIs / Services** | Technologies |
| **AI / ML** | Technologies |
| **DevOps / Deployment** | Technologies |
| **Other Tools** | Technologies |

## System Architecture

<!-- Add your architecture diagram here -->

![System Architecture](./assets/architecture.png)

## Key Features

- Feature 1
- Feature 2
- Feature 3
- Feature 4
- Feature 5

---

# Setup Instructions

## Prerequisites

Make sure the following are installed before running the project:

- Requirement 1
- Requirement 2
- Requirement 3

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/ghanasyam6138-dev/DEFINE4.0
