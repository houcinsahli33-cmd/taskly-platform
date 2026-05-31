const wilayasAlgerie = [
  {
    nom: "Adrar",
    communes: ["Adrar", "Reggane", "Aoulef", "Timimoun"]
  },
  {
    nom: "Chlef",
    communes: ["Chlef", "Oued Fodda", "Ténès", "El Karimia"]
  },
  {
    nom: "Laghouat",
    communes: ["Laghouat", "Aflou", "Hassi R'Mel", "Ksar El Hirane"]
  },
  {
    nom: "Oum El Bouaghi",
    communes: ["Oum El Bouaghi", "Aïn Beïda", "Aïn M'lila", "F'Kirina"]
  },
  {
    nom: "Batna",
    communes: ["Batna", "Barika", "Arris", "Tazoult"]
  },
  {
    nom: "Béjaïa",
    communes: ["Béjaïa", "Akbou", "Tichy", "El Kseur"]
  },
  {
    nom: "Biskra",
    communes: ["Biskra", "Tolga", "Sidi Okba", "El Kantara"]
  },
  {
    nom: "Béchar",
    communes: ["Béchar", "Kenadsa", "Abadla", "Taghit"]
  },
  {
    nom: "Blida",
    communes: ["Blida", "Boufarik", "Béni Mered", "Mouzaïa"]
  },
  {
    nom: "Bouira",
    communes: ["Bouira", "Lakhdaria", "Sour El Ghozlane", "Aïn Bessem"]
  },
  {
    nom: "Tamanrasset",
    communes: ["Tamanrasset", "Abalessa", "In Salah", "In Guezzam"]
  },
  {
    nom: "Tébessa",
    communes: ["Tébessa", "Bir El Ater", "Cheria", "El Aouinet"]
  },
  {
    nom: "Tlemcen",
    communes: ["Tlemcen", "Maghnia", "Remchi", "Nedroma"]
  },
  {
    nom: "Tiaret",
    communes: ["Tiaret", "Frenda", "Sougueur", "Mahdia"]
  },
  {
    nom: "Tizi Ouzou",
    communes: ["Tizi Ouzou", "Azazga", "Draa Ben Khedda", "Larbaâ Nath Irathen"]
  },
  {
    nom: "Alger",
    communes: ["Alger Centre", "Bab Ezzouar", "Bir Mourad Raïs", "El Harrach", "Hydra", "Kouba", "Rouiba", "Zéralda"]
  },
  {
    nom: "Djelfa",
    communes: ["Djelfa", "Aïn Oussera", "Hassi Bahbah", "Messaad"]
  },
  {
    nom: "Jijel",
    communes: ["Jijel", "Taher", "El Milia", "Ziama Mansouriah"]
  },
  {
    nom: "Sétif",
    communes: ["Sétif", "El Eulma", "Aïn Oulmene", "Bougaa"]
  },
  {
    nom: "Saïda",
    communes: ["Saïda", "Aïn El Hadjar", "Youb", "Sidi Boubekeur"]
  },
  {
    nom: "Skikda",
    communes: ["Skikda", "Azzaba", "Collo", "El Harrouch"]
  },
  {
    nom: "Sidi Bel Abbès",
    communes: ["Sidi Bel Abbès", "Telagh", "Sfisef", "Ben Badis"]
  },
  {
    nom: "Annaba",
    communes: ["Annaba", "El Bouni", "Seraïdi", "Berrahal"]
  },
  {
    nom: "Guelma",
    communes: ["Guelma", "Oued Zenati", "Héliopolis", "Bouati Mahmoud"]
  },
  {
    nom: "Constantine",
    communes: ["Constantine", "El Khroub", "Aïn Smara", "Hamma Bouziane"]
  },
  {
    nom: "Médéa",
    communes: ["Médéa", "Berrouaghia", "Ksar El Boukhari", "Beni Slimane"]
  },
  {
    nom: "Mostaganem",
    communes: ["Mostaganem", "Aïn Tedles", "Sidi Ali", "Hassi Mameche"]
  },
  {
    nom: "M'Sila",
    communes: ["M'Sila", "Bou Saâda", "Sidi Aïssa", "Aïn El Hadjel"]
  },
  {
    nom: "Mascara",
    communes: ["Mascara", "Sig", "Mohammadia", "Tighennif"]
  },
  {
    nom: "Ouargla",
    communes: ["Ouargla", "Hassi Messaoud", "Touggourt", "N'Goussa"]
  },
  {
    nom: "Oran",
    communes: ["Oran", "Bir El Djir", "Es Sénia", "Arzew", "Aïn El Turk"]
  },
  {
    nom: "El Bayadh",
    communes: ["El Bayadh", "Bougtob", "Brezina", "Rogassa"]
  },
  {
    nom: "Illizi",
    communes: ["Illizi", "Djanet", "In Amenas", "Bordj Omar Driss"]
  },
  {
    nom: "Bordj Bou Arréridj",
    communes: ["Bordj Bou Arréridj", "Ras El Oued", "Mansoura", "El Achir"]
  },
  {
    nom: "Boumerdès",
    communes: ["Boumerdès", "Boudouaou", "Dellys", "Thenia"]
  },
  {
    nom: "El Tarf",
    communes: ["El Tarf", "El Kala", "Dréan", "Bouteldja"]
  },
  {
    nom: "Tindouf",
    communes: ["Tindouf", "Oum El Assel"]
  },
  {
    nom: "Tissemsilt",
    communes: ["Tissemsilt", "Theniet El Had", "Lardjem", "Bordj Bounaama"]
  },
  {
    nom: "El Oued",
    communes: ["El Oued", "Guemar", "Debila", "Robbah"]
  },
  {
    nom: "Khenchela",
    communes: ["Khenchela", "Kaïs", "Chechar", "Bouhmama"]
  },
  {
    nom: "Souk Ahras",
    communes: ["Souk Ahras", "Sedrata", "M'daourouch", "Taoura"]
  },
  {
    nom: "Tipaza",
    communes: ["Tipaza", "Cherchell", "Koléa", "Bou Ismaïl"]
  },
  {
    nom: "Mila",
    communes: ["Mila", "Chelghoum Laïd", "Tadjenanet", "Ferdjioua"]
  },
  {
    nom: "Aïn Defla",
    communes: ["Aïn Defla", "Khemis Miliana", "Miliana", "El Attaf"]
  },
  {
    nom: "Naâma",
    communes: ["Naâma", "Mécheria", "Aïn Sefra", "Sfissifa"]
  },
  {
    nom: "Aïn Témouchent",
    communes: ["Aïn Témouchent", "Hammam Bou Hadjar", "El Malah", "Béni Saf"]
  },
  {
    nom: "Ghardaïa",
    communes: ["Ghardaïa", "Berriane", "Metlili", "El Meniaa"]
  },
  {
    nom: "Relizane",
    communes: ["Relizane", "Oued Rhiou", "Zemmoura", "Mazouna"]
  }
];

// Remplir la liste des wilayas
function remplirWilayas(selectWilaya, selectCommune) {
  if (!selectWilaya) return;

  selectWilaya.innerHTML = `<option value="">Choisir une wilaya</option>` + wilayasAlgerie
    .map((wilaya) => `<option value="${echapperHTML(wilaya.nom)}">${echapperHTML(wilaya.nom)}</option>`)
    .join("");

  selectWilaya.addEventListener("change", () => {
    remplirCommunes(selectWilaya, selectCommune);
  });
}

// Remplir les communes selon la wilaya
function remplirCommunes(selectWilaya, selectCommune) {
  if (!selectCommune) return;

  const wilaya = wilayasAlgerie.find((item) => item.nom === selectWilaya.value);
  const communes = wilaya ? wilaya.communes : [];

  selectCommune.innerHTML = `<option value="">Choisir une commune</option>` + communes
    .map((commune) => `<option value="${echapperHTML(commune)}">${echapperHTML(commune)}</option>`)
    .join("");
}
