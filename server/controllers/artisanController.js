// Ce fichier contient la logique liée aux artisans.
// Il utilise artisanModel.js pour récupérer les artisans depuis la base de données.

const artisanModel = require("../models/artisanModel"); // on importe les fonctions du fichier artisanModel.js pour interagir avec la table artisans

// La page Artisans utilise la pagination côté serveur. Les anciennes pages
// restent compatibles lorsqu'aucun paramètre "page" n'est donné.
async function listerArtisans(req, res) {
    try {
        const filtres = {
            serviceId: req.query.serviceId,
            wilaya: req.query.wilaya,
            ville: req.query.ville,
            recherche: req.query.recherche
        };
        const pageDemandee = req.query.page !== undefined || req.query.limit !== undefined;
        let pagination = null;
        if (pageDemandee) {
            const brutPage = String(req.query.page || '1');
            const brutLimite = String(req.query.limit || '12');
            if (!/^[1-9]\d*$/.test(brutPage) || !/^[1-9]\d*$/.test(brutLimite)
                || Number(brutPage) > 10000 || Number(brutLimite) > 36) {
                return res.status(400).json({message:'Pagination invalide (page de 1 à 10000, limite de 1 à 36).'});
            }
            pagination = {page:Number(brutPage), limit:Number(brutLimite)};
        }
        const resultat = await artisanModel.trouverTousLesArtisans(filtres, pagination);
        res.status(200).json(pagination ? resultat : {artisans:resultat});
    } catch (error) {
        console.error('Erreur récupération artisans :', error.code || error.message);
        res.status(500).json({message:'Annuaire indisponible. Réessayez plus tard.'});
    }
}

// recuperer details d'un artisan
async function detailArtisan(req, res) {
    try {
        const id = req.params.id;   // on recupere l'id de l'artisan depuis l'url

        const artisan = await artisanModel.trouverArtisanParId(id);   // on recupere l'artisan par son id

        if (!artisan) {
            return res.status(404).json({
                message: "Artisan introuvable."
            });
        }

        res.status(200).json({  // la requete a ete acceptee, on renvoie l'artisan
            artisan: artisan
        });

    } catch (error) {   // si une erreur arrive dans le try, on l'affiche dans la console (terminal)
        console.error("Erreur lors de la récupération des détails de l'artisan :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Carte publique : uniquement profils approuvés et positions approximatives.
async function artisansCarte(req,res){
 try{
  const lat=req.query.lat===undefined?null:Number(req.query.lat);
  const lon=req.query.lon===undefined?null:Number(req.query.lon);
  if((lat===null)!==(lon===null)) return res.status(400).json({message:'Latitude et longitude nécessaires ensemble.'});
  const rayon=Number(req.query.rayonKm||25);
  if((lat!==null||lon!==null)&&(!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180))
    return res.status(400).json({message:'Localisation invalide.'});
  if(!Number.isFinite(rayon)||rayon<1||rayon>100)return res.status(400).json({message:'Rayon invalide.'});
  const filtres={serviceId:req.query.serviceId,wilaya:req.query.wilaya,recherche:req.query.recherche};
  const data=await artisanModel.artisansPourCarte(filtres,lat,lon,rayon);
  res.set('Cache-Control','no-store');res.json({artisans:data});
 }catch(e){console.error('Carte artisans :',e.code||e.message);res.status(503).json({message:'Carte temporairement indisponible.'});}
}
async function enregistrerZone(req,res){
 try{
  const user=req.session?.utilisateur;
  if(req.body?.lat===undefined||req.body?.lon===undefined||req.body?.lat===''||req.body?.lon==='')
    return res.status(400).json({message:'Latitude et longitude obligatoires.'});
  const lat=Number(req.body.lat),lon=Number(req.body.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<18||lat>38||lon< -9||lon>12)
    return res.status(400).json({message:'Position invalide pour une zone en Algérie.'});
  const ok=await artisanModel.enregistrerZone(user.id,lat,lon);
  res.status(ok?200:404).json({message:ok?'Zone publique approximative enregistrée.':'Profil artisan introuvable.'});
 }catch(e){res.status(503).json({message:'Impossible de mettre à jour votre zone.'});}
}
async function supprimerZone(req,res){
 try{
  const ok=await artisanModel.supprimerZone(req.session.utilisateur.id);
  res.status(ok?200:404).json({message:ok?'Zone retirée de la carte.':'Profil artisan introuvable.'});
 }catch(e){res.status(503).json({message:'Impossible de retirer la zone.'});}
}
module.exports = {
    artisansCarte,enregistrerZone,supprimerZone,
    listerArtisans,
    detailArtisan
};
