# companystore.io

Forms for the company: build a form, design how it looks, decide who may
fill it in, branch between pages, and collect the answers in Excel or a
Google Sheet. There is no public sign-up and no admin page: user accounts
are created on the server with `npm run users`.

```
companystore/
├── backend/            Node + Express + MySQL API
│   ├── config/         database connection
│   ├── controllers/    request handlers
│   ├── middleware/     auth guard, security, error handler
│   ├── models/         Sequelize models
│   ├── routes/         endpoint definitions
│   ├── seed/users.js   create and manage user accounts
│   ├── sheets/         Google Sheets two-way sync
│   ├── validation/     who may fill a form in
│   ├── workflow/       logic jumps between pages
│   └── server.js
└── frontend/           React + Vite + React Bootstrap
    ├── public/
    ├── src/
    │   ├── components/ nav, builder, design, validation, workflow
    │   ├── context/    ThemeContext, AuthContext
    │   ├── pages/      Home, UserLogin, Forms, FormBuilder, PublicForm, InfoPages
    │   ├── services/   api.js
    │   └── styles/     builder.css — the app's one stylesheet
    ├── index.html
    └── vite.config.js
```

## First run

**1. Create the database**

```sql
CREATE DATABASE companystore CHARACTER SET utf8mb4;
```

**2. Backend**

```bash
cd backend
npm install
npm run users -- add you@yourcompany.com "Your Name"   # asks for a password
npm run dev                                            # http://localhost:5000
```

Tables are created automatically on first start.

**3. Frontend**

```bash
cd frontend
cp .env.example .env      # then set VITE_API_URL to the backend's address
npm install
npm run dev               # http://localhost:3000
```

## User accounts

Run these in the `backend` folder. Passwords are typed at a hidden prompt,
never on the command line.

```bash
npm run users -- list
npm run users -- add <email> "<Full name>"
npm run users -- reset <email>                         # new password
npm run users -- disable <email>                       # locked out at their next click
npm run users -- enable <email>
npm run users -- remove <email> --give-to <other-email>
```

`remove` hands the person's workbenches and forms to the other account,
so nothing is lost.

## Pages

| Page         | Path              |
|--------------|-------------------|
| Home         | `/`               |
| Log in       | `/login`          |
| Forms home   | `/forms`          |
| Form editor  | `/forms/:id/edit` |
| Public form  | `/f/:publicId`    |
| Info pages   | `/how-it-works`, `/privacy-policy`, `/terms-of-use` |

## Notes

- Only accounts with the role `user` can sign in. Old `admin` rows may stay
  in the `users` table; they can no longer sign in.
- Every request re-reads the account, so disabling or removing someone
  takes effect at their next click, not when their token runs out.
- Passwords are hashed with bcrypt. Only the hash is stored.
- `sequelize.sync()` creates new tables but never changes existing ones.



