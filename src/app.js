const path = require('node:path');
const express = require('express');
const { all, closeDb, createDatabase, get, initDb, run } = require('./db');

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function validateEmployee(payload) {
  const requiredFields = ['name', 'email', 'department', 'role', 'hireDate'];

  for (const field of requiredFields) {
    if (typeof payload[field] !== 'string' || payload[field].trim() === '') {
      throw new HttpError(400, `Invalid or missing field: ${field}`);
    }
  }

  const atIndex = payload.email.indexOf('@');
  const dotIndex = payload.email.lastIndexOf('.');
  if (
    atIndex <= 0
    || dotIndex <= atIndex + 1
    || dotIndex === payload.email.length - 1
    || payload.email.includes(' ')
  ) {
    throw new HttpError(400, 'Invalid email format');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.hireDate)) {
    throw new HttpError(400, 'hireDate must use YYYY-MM-DD format');
  }

  return {
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    department: payload.department.trim(),
    role: payload.role.trim(),
    hireDate: payload.hireDate.trim(),
  };
}

function mapEmployeeRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department,
    role: row.role,
    hireDate: row.hire_date,
  };
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createApp(options = {}) {
  const app = express();
  const dbFilePath = options.dbFilePath || path.join(process.cwd(), 'data', 'employees.db');
  const db = createDatabase(dbFilePath);
  const dbReady = initDb(db);

  app.use(express.json());

  app.use(asyncRoute(async (_req, _res, next) => {
    await dbReady;
    next();
  }));

  app.get('/api/employees', asyncRoute(async (req, res) => {
    const { department, search } = req.query;
    const clauses = [];
    const params = [];

    if (typeof department === 'string' && department.trim() !== '') {
      clauses.push('department = ?');
      params.push(department.trim());
    }

    if (typeof search === 'string' && search.trim() !== '') {
      clauses.push('(name LIKE ? OR email LIKE ? OR role LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await all(
      db,
      `SELECT id, name, email, department, role, hire_date FROM employees ${whereClause} ORDER BY id DESC`,
      params
    );

    res.json(rows.map(mapEmployeeRow));
  }));

  app.get('/api/employees/:id', asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'Employee id must be a positive integer');
    }

    const row = await get(db, 'SELECT id, name, email, department, role, hire_date FROM employees WHERE id = ?', [id]);
    if (!row) {
      throw new HttpError(404, 'Employee not found');
    }

    res.json(mapEmployeeRow(row));
  }));

  app.post('/api/employees', asyncRoute(async (req, res) => {
    const employee = validateEmployee(req.body ?? {});

    const result = await run(
      db,
      'INSERT INTO employees (name, email, department, role, hire_date) VALUES (?, ?, ?, ?, ?)',
      [employee.name, employee.email, employee.department, employee.role, employee.hireDate]
    );

    const row = await get(db, 'SELECT id, name, email, department, role, hire_date FROM employees WHERE id = ?', [result.lastID]);
    res.status(201).json(mapEmployeeRow(row));
  }));

  app.put('/api/employees/:id', asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'Employee id must be a positive integer');
    }

    const employee = validateEmployee(req.body ?? {});

    const result = await run(
      db,
      `UPDATE employees
       SET name = ?, email = ?, department = ?, role = ?, hire_date = ?
       WHERE id = ?`,
      [employee.name, employee.email, employee.department, employee.role, employee.hireDate, id]
    );

    if (result.changes === 0) {
      throw new HttpError(404, 'Employee not found');
    }

    const row = await get(db, 'SELECT id, name, email, department, role, hire_date FROM employees WHERE id = ?', [id]);
    res.json(mapEmployeeRow(row));
  }));

  app.delete('/api/employees/:id', asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'Employee id must be a positive integer');
    }

    const result = await run(db, 'DELETE FROM employees WHERE id = ?', [id]);
    if (result.changes === 0) {
      throw new HttpError(404, 'Employee not found');
    }

    res.status(204).send();
  }));

  app.use('/vendor/react', express.static(path.join(process.cwd(), 'node_modules', 'react', 'umd')));
  app.use('/vendor/react-dom', express.static(path.join(process.cwd(), 'node_modules', 'react-dom', 'umd')));
  app.use('/vendor/babel', express.static(path.join(process.cwd(), 'node_modules', '@babel', 'standalone')));

  app.use(express.static(path.join(process.cwd(), 'public')));

  app.use((error, _req, res, _next) => {
    if (error && error.code === 'SQLITE_CONSTRAINT') {
      res.status(409).json({ error: 'Employee email must be unique' });
      return;
    }

    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  });

  app.locals.closeDb = () => closeDb(db);
  return app;
}

module.exports = { createApp };
