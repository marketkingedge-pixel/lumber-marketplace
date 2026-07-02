const express = require("express");
const router = express.Router();
const { readDB, writeDB, genId } = require("../db");
const { createSession, requireAdmin, destroySession } = require("../middleware/auth");

// --- Auth ---

router.get("/login", (req, res) => {
  res.render("admin/login", { title: "Admin Login", error: null });
});

router.post("/login", (req, res) => {
  const { password } = req.body;
  if (password && password === process.env.ADMIN_PASSWORD) {
    const token = createSession();
    res.cookie("admin_session", token, { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 });
    return res.redirect("/admin");
  }
  res.render("admin/login", { title: "Admin Login", error: "Incorrect password." });
});

router.post("/logout", requireAdmin, (req, res) => {
  destroySession(req.cookies.admin_session);
  res.clearCookie("admin_session");
  res.redirect("/admin/login");
});

// Everything below requires a logged-in admin.
router.use(requireAdmin);

// --- Dashboard ---

router.get("/", (req, res) => {
  const db = readDB();
  res.render("admin/dashboard", {
    title: "Admin Dashboard",
    listings: db.listings.map((l) => ({ ...l, company: db.companies.find((c) => c.id === l.companyId) })),
    companies: db.companies,
    requests: db.requests,
  });
});

// --- Listings ---

router.get("/listings/new", (req, res) => {
  const db = readDB();
  res.render("admin/listing-form", { title: "Add Listing", listing: null, companies: db.companies });
});

router.get("/listings/:id/edit", (req, res) => {
  const db = readDB();
  const listing = db.listings.find((l) => l.id === req.params.id);
  if (!listing) return res.status(404).send("Listing not found");
  res.render("admin/listing-form", { title: "Edit Listing", listing, companies: db.companies });
});

router.post("/listings", (req, res) => {
  const db = readDB();
  const { companyId, category, species, dimensions, quantity, unit, price, discountNotes, photoUrl, expiresOn, id } = req.body;

  if (id) {
    const listing = db.listings.find((l) => l.id === id);
    if (listing) {
      Object.assign(listing, { companyId, category, species, dimensions, quantity, unit, price, discountNotes, photoUrl, expiresOn });
    }
  } else {
    db.listings.push({
      id: genId("l"),
      companyId,
      category,
      species,
      dimensions,
      quantity,
      unit,
      price,
      discountNotes: discountNotes || "",
      photoUrl: photoUrl || "",
      status: "active",
      datePosted: new Date().toISOString().slice(0, 10),
      expiresOn: expiresOn || "",
    });
  }

  writeDB(db);
  res.redirect("/admin");
});

router.post("/listings/:id/status", (req, res) => {
  const db = readDB();
  const listing = db.listings.find((l) => l.id === req.params.id);
  if (listing) {
    listing.status = req.body.status;
    writeDB(db);
  }
  res.redirect("/admin");
});

router.post("/listings/:id/delete", (req, res) => {
  const db = readDB();
  db.listings = db.listings.filter((l) => l.id !== req.params.id);
  writeDB(db);
  res.redirect("/admin");
});

// --- Companies ---

router.get("/companies/new", (req, res) => {
  res.render("admin/company-form", { title: "Add Company", company: null });
});

router.get("/companies/:id/edit", (req, res) => {
  const db = readDB();
  const company = db.companies.find((c) => c.id === req.params.id);
  if (!company) return res.status(404).send("Company not found");
  res.render("admin/company-form", { title: "Edit Company", company });
});

router.post("/companies", (req, res) => {
  const db = readDB();
  const { id, name, phone, email, location, notes } = req.body;

  if (id) {
    const company = db.companies.find((c) => c.id === id);
    if (company) Object.assign(company, { name, phone, email, location, notes });
  } else {
    db.companies.push({ id: genId("c"), name, phone, email, location, notes: notes || "" });
  }

  writeDB(db);
  res.redirect("/admin");
});

router.post("/companies/:id/delete", (req, res) => {
  const db = readDB();
  const inUse = db.listings.some((l) => l.companyId === req.params.id);
  if (inUse) {
    return res.status(400).send("Can't delete a company that still has listings. Remove or reassign those listings first.");
  }
  db.companies = db.companies.filter((c) => c.id !== req.params.id);
  writeDB(db);
  res.redirect("/admin");
});

// --- Requests (moderation) ---

router.post("/requests/:id/status", (req, res) => {
  const db = readDB();
  const request = db.requests.find((r) => r.id === req.params.id);
  if (request) {
    request.status = req.body.status;
    writeDB(db);
  }
  res.redirect("/admin");
});

router.post("/requests/:id/delete", (req, res) => {
  const db = readDB();
  db.requests = db.requests.filter((r) => r.id !== req.params.id);
  writeDB(db);
  res.redirect("/admin");
});

module.exports = router;
