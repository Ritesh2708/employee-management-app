# employee-management-app
An enterprise employee management system with CRUD operations

## Tech Stack
- Node.js + Express REST API
- SQLite database
- React frontend

## Features
- CRUD operations for employee records
- Employee fields: ID, Name, Email, Department, Role, Hire Date
- Search by name/email/role and filter by department
- RESTful API with error handling

## Run locally
```bash
npm install
npm start
```

Open `http://localhost:3000`.

## API
- `GET /api/employees?department=<name>&search=<text>`
- `GET /api/employees/:id`
- `POST /api/employees`
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id`

Employee payload:
```json
{
  "name": "Jane Doe",
  "email": "jane@company.com",
  "department": "Engineering",
  "role": "Software Engineer",
  "hireDate": "2024-01-15"
}
```
