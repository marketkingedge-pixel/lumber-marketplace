const express = require("express");
const router = express.Router();
const { readDB, writeDB, genId } = require("../db");

function companyById(db, id) {
  return db.companies.find((c) => c.id === id);
}

// Home / Browse Specials
router.get("/", (req, res) => {
  const db = readDB();
  const { category, company, species, q } = req.query;

  let listings = db.listings.filter((l) => l.status === "active");

  if (category) listings = listings.filter((l) => l.category === category);
  if (company) listings = listings.filter((l) => l.companyId === company);
  if (species) listings = listings.filter((l) => l.species.toLowerCase().includes(species.toLowerCase()));
  if (q) {
    const needle = q.toLowerCase();
    listings = listings.filter(
      (l) =>
        l.category.toLowerCase().includes(needle) ||
        l.species.toLowerCase().includes(needle) ||
        (l.discountNotes || "").toLowerCase().includes(needle)
    );
  }

  listings = listings
    .map((l) => ({ ...l, company: companyById(db, l.companyId) }))
    .sort((a, b) => (a.datePosted < b.datePosted ? 1 : -1));

  const categories = [...new Set(db.listings.map((l) => l.category))].sort();

  res.render("home", {
    title: "Browse Specials",
    listings,
    categories,
    companies: db.companies,
    filters: { category: category || "", company: company || "", species: species || "", q: q || "" },
  });
});

// Company Directory
router.get("/companies", (req, res) => {
  const db = readDB();
  const companies = db.companies.map((c) => ({
    ...c,
    activeListingCount: db.listings.filter((l) => l.companyId === c.id && l.status === "active").length,
  }));
  res.render("companies", { title: "Company Directory", companies });
});

// Material Request Board
router.get("/requests", (req, res) => {
  const db = readDB();
  const open = db.requests
    .filter((r) => r.status === "open")
    .sort((a, b) => (a.datePosted < b.datePosted ? 1 : -1));
  const fulfilled = db.requests
    .filter((r) => r.status === "fulfilled")
    .sort((a, b) => (a.datePosted < b.datePosted ? 1 : -1));

  res.render("requests", { title: "Material Request Board", open, fulfilled, prefill: null, showForm: false });
});

// New request form (also handles prefill from the Project Scanner via query params)
router.get("/requests/new", (req, res) => {
  const db = readDB();
  const open = db.requests.filter((r) => r.status === "open").sort((a, b) => (a.datePosted < b.datePosted ? 1 : -1));
  const fulfilled = db.requests.filter((r) => r.status === "fulfilled").sort((a, b) => (a.datePosted < b.datePosted ? 1 : -1));

  const prefill = {
    materialNeeded: req.query.materialNeeded || "",
    specs: req.query.specs || "",
    quantity: req.query.quantity || "",
    photoUrl: req.query.photoUrl || "",
  };

  res.render("requests", { title: "Material Request Board", open, fulfilled, prefill, showForm: true });
});

router.post("/requests", (req, res) => {
  const db = readDB();
  const { requesterName, contact, materialNeeded, specs, quantity, deadline, photoUrl } = req.body;

  if (!requesterName || !contact || !materialNeeded) {
    return res.status(400).send("Name, contact info, and material needed are required.");
  }

  db.requests.push({
    id: genId("r"),
    requesterName,
    contact,
    materialNeeded,
    specs: specs || "",
    quantity: quantity || "",
    deadline: deadline || "",
    status: "open",
    datePosted: new Date().toISOString().slice(0, 10),
    notes: "",
    photoUrl: photoUrl || "",
    source: photoUrl ? "scanner" : "manual",
  });

  writeDB(db);
  res.redirect("/requests");
});

module.exports = router;
