USE taskly_db;

SET NAMES utf8mb4;

-- Mot de passe commun pour tous les comptes : 123456
-- Remplace cette valeur par le hash bcrypt genere avec PowerShell
SET @mdp = '$2b$10$WwJZrgWVZT5kAGBSaiEB2.Ty01E3ZHt68jjqIPo2OEJeOc1fsag2S';


SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM signalements;
DELETE FROM contacts_support;
DELETE FROM avis;
DELETE FROM demandes;
DELETE FROM artisans;
DELETE FROM clients;
DELETE FROM users;
DELETE FROM services;

ALTER TABLE signalements AUTO_INCREMENT = 1;
ALTER TABLE contacts_support AUTO_INCREMENT = 1;
ALTER TABLE avis AUTO_INCREMENT = 1;
ALTER TABLE demandes AUTO_INCREMENT = 1;
ALTER TABLE artisans AUTO_INCREMENT = 1;
ALTER TABLE clients AUTO_INCREMENT = 1;
ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE services AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

START TRANSACTION;

-- =========================================================
-- SERVICES
-- =========================================================

INSERT INTO services (id, nom, description, image)
VALUES
(1, 'Plomberie', 'Services de plomberie pour la maison, les fuites, les sanitaires et les urgences.', '/images/services/plomberie.jpg'),
(2, 'Electricite', 'Installation, depannage et reparation electrique pour logements et petits locaux.', '/images/services/electricite.jpg'),
(3, 'Peinture', 'Travaux de peinture interieure, exterieure, renovation et finitions murales.', '/images/services/peinture.jpg'),
(4, 'Menuiserie', 'Fabrication, reparation et ajustement de meubles, portes, placards et bois.', '/images/services/menuiserie.jpg'),
(5, 'Nettoyage', 'Nettoyage de maisons, appartements, bureaux, escaliers et locaux apres travaux.', '/images/services/nettoyage.jpg'),
(6, 'Climatisation', 'Installation, entretien, nettoyage et reparation de climatiseurs.', '/images/services/climatisation.jpg'),
(7, 'Jardinage', 'Entretien de jardins, taille, nettoyage exterieur et petits travaux verts.', '/images/services/jardinage.jpg'),
(8, 'Demenagement', 'Aide au demenagement, transport de petits meubles, cartons et organisation.', '/images/services/demenagement.jpg'),
(9, 'Electromenager', 'Diagnostic, installation et petites reparations d appareils electromenagers.', '/images/services/electromenager.jpg'),
(10, 'Carrelage', 'Pose, remplacement et reparation de carrelage pour sols et murs.', '/images/services/carrelage.jpg'),
(11, 'Maconnerie', 'Petits travaux de maconnerie, reparations et amenagements simples.', '/images/services/maconnerie.jpg'),
(12, 'Serrurerie', 'Ouverture de porte, changement de serrure et securisation simple.', '/images/services/serrurerie.jpg');

-- =========================================================
-- USERS
-- =========================================================

INSERT INTO users (id, nom, prenom, email, mot_de_passe, role, photo_profil, statut_compte, motif_blocage, date_blocage)
VALUES
(1, 'Admin', 'Taskly', 'admin.taskly@gmail.com', @mdp, 'admin', NULL, 'actif', NULL, NULL),

(2, 'Ait Ali', 'Sarah', 'sarah.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(3, 'Mansouri', 'Karim', 'karim.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(4, 'Belaid', 'Nadia', 'nadia.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(5, 'Hamadi', 'Youcef', 'youcef.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(6, 'Cherif', 'Amel', 'amel.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(7, 'Kaci', 'Rania', 'rania.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(8, 'Saidi', 'Samir', 'samir.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(9, 'Toumi', 'Lila', 'lila.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(10, 'Boukhalfa', 'Souad', 'souad.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(11, 'Yahiaoui', 'Mehdi', 'mehdi.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(12, 'Bensalem', 'Imane', 'imane.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(13, 'Djabri', 'Anis', 'anis.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(14, 'Ferhat', 'Sabrina', 'sabrina.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(15, 'Amrani', 'Rachid', 'rachid.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(16, 'Ziani', 'Meriem', 'meriem.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),
(17, 'Ouali', 'Bilal', 'bilal.client@gmail.com', @mdp, 'client', NULL, 'actif', NULL, NULL),

(18, 'Benali', 'Mourad', 'mourad.plombier@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(19, 'Rahmani', 'Walid', 'walid.plombier@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(20, 'Kaci', 'Salim', 'salim.electricien@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(21, 'Haddad', 'Nabil', 'nabil.electricien@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(22, 'Mansouri', 'Farid', 'farid.peintre@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(23, 'Saidi', 'Hakim', 'hakim.peintre@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(24, 'Belkacem', 'Adel', 'adel.menuisier@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(25, 'Mahdi', 'Yacine', 'yacine.menuisier@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(26, 'Toumi', 'Sofiane', 'sofiane.nettoyage@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(27, 'Rahmani', 'Walid', 'walid.nettoyage@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(28, 'Cherif', 'Omar', 'omar.climatisation@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(29, 'Boudiaf', 'Mehdi', 'mehdi.climatisation@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(30, 'Test', 'ArtisanBloque', 'artisan.bloque@gmail.com', @mdp, 'artisan', NULL, 'bloque', 'Compte bloque pour test de moderation admin.', NOW()),
(31, 'Guerfi', 'Kamel', 'kamel.jardinage@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(32, 'Hamrouche', 'Nacer', 'nacer.jardinage@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(33, 'Bellil', 'Said', 'said.demenagement@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(34, 'Khelifi', 'Reda', 'reda.electromenager@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(35, 'Bouras', 'Fateh', 'fateh.carrelage@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(36, 'Mokrani', 'Ali', 'ali.maconnerie@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(37, 'Sellami', 'Samy', 'samy.serrurerie@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(38, 'Hannachi', 'Rabah', 'rabah.plomberie@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(39, 'Lounis', 'Idir', 'idir.electricite@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(40, 'Brahimi', 'Nassim', 'nassim.nettoyage@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(41, 'Ammar', 'Fares', 'fares.climatisation@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(42, 'Chaouch', 'Riad', 'riad.peinture@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(43, 'Meziane', 'Massinissa', 'massinissa.menuiserie@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL),
(44, 'Bouzid', 'Hichem', 'hichem.demenagement@gmail.com', @mdp, 'artisan', NULL, 'actif', NULL, NULL);

-- =========================================================
-- CLIENTS
-- =========================================================

INSERT INTO clients (id, user_id, telephone, ville, adresse)
VALUES
(1, 2, '0551000001', 'Tizi Ouzou', 'Nouvelle ville, Tizi Ouzou'),
(2, 3, '0551000002', 'Alger Centre', 'Rue Didouche Mourad, Alger'),
(3, 4, '0551000003', 'Blida', 'Centre ville, Blida'),
(4, 5, '0551000004', 'Oran', 'Hai Es Sabah, Oran'),
(5, 6, '0551000005', 'Bejaia', 'Quartier Sidi Ahmed, Bejaia'),
(6, 7, '0551000006', 'Constantine', 'Ali Mendjeli, Constantine'),
(7, 8, '0551000007', 'Boumerdes', 'Centre ville, Boumerdes'),
(8, 9, '0551000008', 'Tlemcen', 'Imama, Tlemcen'),
(9, 10, '0561000001', 'Ouled Yaich', 'Ouled Yaich, Blida'),
(10, 11, '0561000002', 'Azazga', 'Centre ville, Azazga'),
(11, 12, '0561000003', 'Hydra', 'Hydra, Alger'),
(12, 13, '0561000004', 'Bir Mourad Rais', 'Bir Mourad Rais, Alger'),
(13, 14, '0561000005', 'Tizi Ouzou', 'Mdouha, Tizi Ouzou'),
(14, 15, '0561000006', 'Bejaia', 'Ihaddaden, Bejaia'),
(15, 16, '0561000007', 'Setif', 'El Hidhab, Setif'),
(16, 17, '0561000008', 'Annaba', 'Sidi Amar, Annaba');

-- =========================================================
-- ARTISANS
-- =========================================================

INSERT INTO artisans (id, user_id, service_id, ville, telephone, description, experience)
VALUES
(1, 18, 1, 'Tizi Ouzou', '0552000001', 'Plombier disponible pour les reparations, installations sanitaires, fuites et urgences a domicile.', 8),
(2, 19, 1, 'Alger Centre', '0552000002', 'Specialiste en plomberie generale, installation de robinets, chauffe-eau et entretien des canalisations.', 5),
(3, 20, 2, 'Tizi Ouzou', '0552000003', 'Electricien qualifie pour depannage, installation de prises, tableaux electriques et mise en securite.', 10),
(4, 21, 2, 'Bab Ezzouar', '0552000004', 'Interventions electriques rapides pour appartements, locaux et petites installations domestiques.', 6),
(5, 22, 3, 'Blida', '0552000005', 'Peintre professionnel pour peinture interieure, renovation de murs et finitions propres.', 7),
(6, 23, 3, 'Oran', '0552000006', 'Travaux de peinture, enduit, decoration murale et remise a neuf des pieces.', 4),
(7, 24, 4, 'Boumerdes', '0552000007', 'Menuisier specialise dans la reparation de portes, placards, meubles et petits travaux en bois.', 12),
(8, 25, 4, 'Bejaia', '0552000008', 'Fabrication et reparation de meubles, ajustement de portes et travaux de menuiserie sur mesure.', 9),
(9, 26, 5, 'Constantine', '0552000009', 'Service de nettoyage pour maisons, appartements, bureaux et locaux apres travaux.', 3),
(10, 27, 5, 'Alger Centre', '0552000010', 'Nettoyage regulier ou ponctuel, entretien complet, organisation et remise en propre.', 5),
(11, 28, 6, 'Tlemcen', '0552000011', 'Installation, entretien et reparation de climatiseurs avec verification complete du systeme.', 8),
(12, 29, 6, 'Tizi Ouzou', '0552000012', 'Technicien en climatisation pour installation, recharge, nettoyage et diagnostic rapide.', 6),
(13, 30, 1, 'Blida', '0552000013', 'Artisan bloque utilise seulement pour tester le comportement du site et du dashboard admin.', 2),
(14, 31, 7, 'Tizi Ouzou', '0562000001', 'Jardinier disponible pour entretien de jardins, taille de plantes, nettoyage exterieur et petits travaux verts.', 6),
(15, 32, 7, 'Blida', '0562000002', 'Entretien regulier de jardins, nettoyage de cours et preparation des espaces exterieurs.', 4),
(16, 33, 8, 'Alger Centre', '0562000003', 'Aide au demenagement, transport de cartons et petits meubles avec organisation soignee.', 5),
(17, 34, 9, 'Bab Ezzouar', '0562000004', 'Technicien pour installation et petite reparation de machines a laver, fours et refrigerateurs.', 7),
(18, 35, 10, 'Setif', '0562000005', 'Carreleur pour pose de carrelage, remplacement de pieces cassees et finitions propres.', 9),
(19, 36, 11, 'Annaba', '0562000006', 'Petits travaux de maconnerie, reparations de murs, seuils et amenagements simples.', 11),
(20, 37, 12, 'Hydra', '0562000007', 'Serrurier pour ouverture de porte, changement de serrure et securisation simple.', 8),
(21, 38, 1, 'Azazga', '0562000008', 'Plombier pour fuites, installation sanitaire, remplacement de robinets et depannage rapide.', 6),
(22, 39, 2, 'Ouled Yaich', '0562000009', 'Electricien pour prises, luminaires, depannage et verification des installations domestiques.', 8),
(23, 40, 5, 'Bir Mourad Rais', '0562000010', 'Nettoyage de maisons, appartements, escaliers, bureaux et remise en etat apres travaux.', 4),
(24, 41, 6, 'Bejaia', '0562000011', 'Technicien en climatisation pour entretien, installation, nettoyage et diagnostic.', 10),
(25, 42, 3, 'Setif', '0562000012', 'Peintre pour renovation interieure, murs, plafonds, enduit et finitions modernes.', 6),
(26, 43, 4, 'Annaba', '0562000013', 'Menuisier pour portes, placards, meubles sur mesure et reparations en bois.', 13),
(27, 44, 8, 'Tizi Ouzou', '0562000014', 'Aide au transport, petits demenagements, manutention et organisation des cartons.', 3);

-- =========================================================
-- DEMANDES
-- =========================================================

INSERT INTO demandes (id, client_id, artisan_id, message, adresse, date_souhaitee, statut, annulee_par, motif_annulation, date_traitement, date_annulation, created_at)
VALUES
(1, 1, 1, 'Bonjour, j ai une fuite sous l evier de la cuisine. Je souhaite une intervention rapide.', 'Nouvelle ville, Tizi Ouzou', '2026-06-05', 'terminee', NULL, NULL, '2026-06-05 18:30:00', NULL, '2026-05-10 09:15:00'),
(2, 2, 3, 'Je veux installer plusieurs prises dans mon appartement.', 'Alger Centre', '2026-06-06', 'terminee', NULL, NULL, '2026-06-06 17:00:00', NULL, '2026-05-11 11:20:00'),
(3, 3, 5, 'Je veux repeindre deux chambres.', 'Centre ville, Blida', '2026-06-10', 'en_attente', NULL, NULL, NULL, NULL, '2026-05-12 14:10:00'),
(4, 4, 2, 'J ai besoin de reparer une fuite dans la salle de bain.', 'Hai Es Sabah, Oran', '2026-06-11', 'acceptee', NULL, NULL, '2026-05-13 10:40:00', NULL, '2026-05-13 09:00:00'),
(5, 5, 6, 'Peinture complete du salon avec finition propre.', 'Sidi Ahmed, Bejaia', '2026-06-12', 'terminee', NULL, NULL, '2026-06-12 16:20:00', NULL, '2026-05-14 08:45:00'),
(6, 6, 4, 'Verification du tableau electrique.', 'Ali Mendjeli, Constantine', '2026-06-13', 'refusee', NULL, NULL, '2026-05-15 12:30:00', NULL, '2026-05-15 11:00:00'),
(7, 7, 8, 'Reparation d une porte en bois.', 'Centre ville, Boumerdes', '2026-06-14', 'annulee', 'client', 'Le client a reporte les travaux.', NULL, '2026-05-16 15:00:00', '2026-05-16 10:10:00'),
(8, 8, 7, 'Creation d une petite etagere murale.', 'Imama, Tlemcen', '2026-06-15', 'terminee', NULL, NULL, '2026-06-15 19:00:00', NULL, '2026-05-17 13:30:00'),
(9, 2, 9, 'Nettoyage complet apres demenagement.', 'Alger Centre', '2026-06-16', 'en_attente', NULL, NULL, NULL, NULL, '2026-05-18 16:20:00'),
(10, 1, 10, 'Nettoyage d un appartement avant location.', 'Tizi Ouzou', '2026-06-17', 'terminee', NULL, NULL, '2026-06-17 15:10:00', NULL, '2026-05-19 09:45:00'),
(11, 3, 11, 'Climatisation qui ne refroidit plus correctement.', 'Blida', '2026-06-18', 'acceptee', NULL, NULL, '2026-05-20 14:00:00', NULL, '2026-05-20 12:10:00'),
(12, 4, 12, 'Nettoyage et recharge d un climatiseur.', 'Oran', '2026-06-19', 'terminee', NULL, NULL, '2026-06-19 18:40:00', NULL, '2026-05-21 17:00:00'),
(13, 5, 1, 'Installation d un nouveau robinet.', 'Bejaia', '2026-06-20', 'refusee', NULL, NULL, '2026-05-22 10:30:00', NULL, '2026-05-22 09:25:00'),
(14, 6, 3, 'Depannage urgent pour une panne electrique.', 'Constantine', '2026-06-21', 'annulee', 'artisan', 'L artisan n etait pas disponible a cette date.', NULL, '2026-05-23 18:00:00', '2026-05-23 16:30:00'),
(15, 7, 4, 'Installation de luminaires dans le salon.', 'Boumerdes', '2026-06-22', 'terminee', NULL, NULL, '2026-06-22 20:10:00', NULL, '2026-05-24 10:00:00'),
(16, 8, 5, 'Peinture d une chambre enfant.', 'Tlemcen', '2026-06-23', 'en_attente', NULL, NULL, NULL, NULL, '2026-05-25 15:15:00'),
(17, 3, 13, 'Test avec artisan bloque.', 'Blida', '2026-06-24', 'terminee', NULL, NULL, '2026-06-24 13:20:00', NULL, '2026-05-26 08:40:00'),
(18, 5, 2, 'Reparation d une fuite dans la cuisine.', 'Bejaia', '2026-06-25', 'terminee', NULL, NULL, '2026-06-25 17:50:00', NULL, '2026-05-27 11:55:00'),
(19, 6, 11, 'Installation d un climatiseur dans une chambre.', 'Constantine', '2026-06-26', 'terminee', NULL, NULL, '2026-06-26 16:00:00', NULL, '2026-05-28 09:30:00'),
(20, 7, 6, 'Peinture du couloir et de l entree.', 'Boumerdes', '2026-06-27', 'en_attente', NULL, NULL, NULL, NULL, '2026-05-29 13:45:00'),
(21, 9, 15, 'Je veux nettoyer et arranger le petit jardin de la maison.', 'Ouled Yaich, Blida', '2026-07-01', 'terminee', NULL, NULL, '2026-07-01 17:30:00', NULL, '2026-06-01 09:00:00'),
(22, 10, 21, 'Fuite dans la salle de bain, besoin d une intervention rapide.', 'Azazga, Tizi Ouzou', '2026-07-02', 'terminee', NULL, NULL, '2026-07-02 15:45:00', NULL, '2026-06-02 10:20:00'),
(23, 11, 20, 'La porte d entree ferme mal, je veux changer la serrure.', 'Hydra, Alger', '2026-07-03', 'terminee', NULL, NULL, '2026-07-03 19:00:00', NULL, '2026-06-03 11:10:00'),
(24, 12, 23, 'Nettoyage complet d un appartement avant location.', 'Bir Mourad Rais, Alger', '2026-07-04', 'en_attente', NULL, NULL, NULL, NULL, '2026-06-04 12:35:00'),
(25, 13, 14, 'Taille de plantes et nettoyage d une petite cour.', 'Mdouha, Tizi Ouzou', '2026-07-05', 'acceptee', NULL, NULL, '2026-06-05 14:15:00', NULL, '2026-06-05 08:50:00'),
(26, 14, 24, 'Climatiseur qui fait du bruit et refroidit mal.', 'Ihaddaden, Bejaia', '2026-07-06', 'terminee', NULL, NULL, '2026-07-06 18:20:00', NULL, '2026-06-06 13:00:00'),
(27, 15, 18, 'Pose de carrelage dans une petite cuisine.', 'El Hidhab, Setif', '2026-07-07', 'terminee', NULL, NULL, '2026-07-07 16:40:00', NULL, '2026-06-07 15:30:00'),
(28, 16, 19, 'Reparation d un petit mur exterieur.', 'Sidi Amar, Annaba', '2026-07-08', 'en_attente', NULL, NULL, NULL, NULL, '2026-06-08 09:45:00'),
(29, 11, 17, 'Ma machine a laver ne demarre plus.', 'Hydra, Alger', '2026-07-09', 'acceptee', NULL, NULL, '2026-06-09 16:00:00', NULL, '2026-06-09 14:20:00'),
(30, 13, 27, 'Aide pour transporter quelques meubles dans le meme quartier.', 'Tizi Ouzou', '2026-07-10', 'terminee', NULL, NULL, '2026-07-10 12:30:00', NULL, '2026-06-10 10:10:00'),
(31, 10, 22, 'Installation de deux luminaires dans le salon.', 'Azazga, Tizi Ouzou', '2026-07-11', 'refusee', NULL, NULL, '2026-06-11 17:20:00', NULL, '2026-06-11 11:25:00'),
(32, 9, 25, 'Peinture d un couloir et retouches sur les murs.', 'Ouled Yaich, Blida', '2026-07-12', 'terminee', NULL, NULL, '2026-07-12 18:00:00', NULL, '2026-06-12 09:40:00'),
(33, 12, 16, 'Petit demenagement avec cartons et table.', 'Bir Mourad Rais, Alger', '2026-07-13', 'annulee', 'client', 'Le client a change la date du demenagement.', NULL, '2026-06-13 15:30:00', '2026-06-13 12:00:00'),
(34, 14, 26, 'Reparation d une porte de placard.', 'Bejaia', '2026-07-14', 'terminee', NULL, NULL, '2026-07-14 20:10:00', NULL, '2026-06-14 13:15:00'),
(35, 15, 18, 'Remplacement de quelques carreaux abimes dans la salle de bain.', 'Setif', '2026-07-15', 'en_attente', NULL, NULL, NULL, NULL, '2026-06-15 10:00:00'),
(36, 16, 26, 'Fabrication d une petite etagere murale.', 'Annaba', '2026-07-16', 'terminee', NULL, NULL, '2026-07-16 17:15:00', NULL, '2026-06-16 16:10:00'),
(37, 9, 22, 'Verifier une prise qui chauffe dans la cuisine.', 'Ouled Yaich, Blida', '2026-07-17', 'en_attente', NULL, NULL, NULL, NULL, '2026-06-17 10:20:00'),
(38, 10, 14, 'Nettoyage de jardin avant une petite reception familiale.', 'Azazga', '2026-07-18', 'annulee', 'artisan', 'L artisan n etait pas disponible ce jour-la.', NULL, '2026-06-18 19:20:00', '2026-06-18 08:30:00'),
(39, 11, 17, 'Verifier un four electrique qui chauffe mal.', 'Hydra', '2026-07-19', 'terminee', NULL, NULL, '2026-07-19 14:45:00', NULL, '2026-06-19 09:10:00'),
(40, 12, 20, 'Changer une serrure de chambre.', 'Bir Mourad Rais', '2026-07-20', 'en_attente', NULL, NULL, NULL, NULL, '2026-06-20 12:40:00'),
(41, 13, 21, 'Installation d un nouveau lavabo.', 'Tizi Ouzou', '2026-07-21', 'acceptee', NULL, NULL, '2026-06-21 17:20:00', NULL, '2026-06-21 15:00:00'),
(42, 14, 23, 'Nettoyage complet apres petits travaux.', 'Bejaia', '2026-07-22', 'terminee', NULL, NULL, '2026-07-22 18:10:00', NULL, '2026-06-22 13:25:00'),
(43, 15, 25, 'Peinture d un mur dans le salon.', 'Setif', '2026-07-23', 'refusee', NULL, NULL, '2026-06-23 11:35:00', NULL, '2026-06-23 10:15:00'),
(44, 16, 19, 'Petite reparation de marche exterieure.', 'Annaba', '2026-07-24', 'terminee', NULL, NULL, '2026-07-24 16:50:00', NULL, '2026-06-24 09:55:00'),
(45, 11, 16, 'Transport de deux cartons et une chaise.', 'Hydra', '2026-07-25', 'en_attente', NULL, NULL, NULL, NULL, '2026-06-25 14:20:00');

-- =========================================================
-- AVIS
-- =========================================================

INSERT INTO avis (demande_id, client_id, artisan_id, note, commentaire, created_at)
VALUES
(1, 1, 1, 5, 'Intervention rapide, travail propre et artisan tres serieux.', '2026-06-05 20:00:00'),
(2, 2, 3, 4, 'Bon travail, installation propre. Petit retard mais resultat satisfaisant.', '2026-06-06 18:10:00'),
(5, 5, 6, 5, 'Peinture propre, finition soignee et bon respect du delai.', '2026-06-12 18:00:00'),
(8, 8, 7, 4, 'Travail bien fait, l etagere est solide et propre.', '2026-06-15 20:00:00'),
(10, 1, 10, 5, 'Nettoyage complet et tres bon resultat.', '2026-06-17 18:30:00'),
(12, 4, 12, 3, 'Service correct, mais la communication pouvait etre meilleure.', '2026-06-19 20:00:00'),
(15, 7, 4, 4, 'Installation bien faite et artisan poli.', '2026-06-22 21:30:00'),
(17, 3, 13, 3, 'Test de moderation, service moyen.', '2026-06-24 15:00:00'),
(18, 5, 2, 5, 'Plombier tres efficace, probleme regle rapidement.', '2026-06-25 19:00:00'),
(19, 6, 11, 4, 'Installation correcte et explications claires.', '2026-06-26 18:15:00'),
(21, 9, 15, 5, 'Jardin bien nettoye, travail rapide et propre.', '2026-07-01 19:00:00'),
(22, 10, 21, 5, 'Plombier tres efficace, la fuite a ete reparee rapidement.', '2026-07-02 18:00:00'),
(23, 11, 20, 4, 'Serrure changee correctement, service serieux.', '2026-07-03 20:30:00'),
(26, 14, 24, 4, 'Bon diagnostic du climatiseur, probleme regle.', '2026-07-06 19:30:00'),
(27, 15, 18, 5, 'Carrelage bien pose et finitions propres.', '2026-07-07 18:20:00'),
(30, 13, 27, 4, 'Demenagement rapide et sans probleme.', '2026-07-10 14:00:00'),
(32, 9, 25, 3, 'Travail correct, mais il y avait un peu de retard.', '2026-07-12 19:10:00'),
(34, 14, 26, 5, 'Menuisier tres professionnel, porte reparee proprement.', '2026-07-14 21:00:00'),
(36, 16, 26, 4, 'Etagere bien faite, bon rapport qualite service.', '2026-07-16 18:45:00'),
(39, 11, 17, 3, 'Le four fonctionne mieux, mais la communication etait moyenne.', '2026-07-19 16:00:00'),
(42, 14, 23, 5, 'Nettoyage tres propre apres les travaux.', '2026-07-22 19:20:00'),
(44, 16, 19, 4, 'Reparation solide, artisan ponctuel.', '2026-07-24 18:10:00');

-- =========================================================
-- SIGNALEMENTS
-- =========================================================

INSERT INTO signalements (id, demande_id, signaleur_user_id, signale_user_id, motif, description, created_at)
VALUES
(1, 1, 2, 18, 'Retard important', 'Le client signale un retard important avant l intervention.', '2026-06-05 21:00:00'),
(2, 4, 19, 5, 'Ne repond pas', 'L artisan indique que le client ne repondait pas pour confirmer les details.', '2026-05-14 09:00:00'),
(3, 14, 20, 7, 'Annulation abusive', 'L artisan signale une annulation tardive apres preparation du materiel.', '2026-05-24 09:40:00'),
(4, 17, 4, 30, 'Comportement non professionnel', 'Signalement utilise pour tester un artisan bloque.', '2026-06-24 16:00:00'),
(5, 3, 4, 22, 'Fausse information', 'Le client souhaite signaler des informations peu claires avant confirmation.', '2026-05-12 18:00:00'),
(6, 25, 14, 31, 'Retard important', 'Le client signale un retard dans la confirmation du rendez-vous.', '2026-06-05 19:00:00'),
(7, 33, 33, 13, 'Annulation abusive', 'L artisan signale une annulation apres preparation du transport.', '2026-06-13 16:00:00'),
(8, 38, 31, 11, 'Probleme avec la demande', 'L artisan indique que les informations de la demande etaient incompletes.', '2026-06-18 20:00:00'),
(9, 40, 13, 37, 'Ne repond pas', 'Le client indique que l artisan ne repondait pas aux messages.', '2026-06-20 18:00:00'),
(10, 41, 14, 38, 'Fausse information', 'Le client souhaite verifier des informations donnees avant intervention.', '2026-06-21 18:30:00'),
(11, 43, 42, 16, 'Comportement non professionnel', 'L artisan signale un echange peu respectueux.', '2026-06-23 13:00:00'),
(12, 24, 13, 40, 'Autre', 'Signalement de test pour verifier la liste admin.', '2026-06-24 10:30:00'),
(13, 45, 12, 33, 'Ne repond pas', 'Le client indique que l artisan tarde a confirmer la demande.', '2026-06-25 15:10:00');

-- =========================================================
-- CONTACTS SUPPORT
-- =========================================================

INSERT INTO contacts_support (id, nom, email, sujet, message, statut, created_at, date_traitement)
VALUES
(1, 'Sarah Ait Ali', 'sarah.client@gmail.com', 'Probleme avec une demande', 'Je souhaite avoir plus d informations sur le suivi de ma demande.', 'nouveau', '2026-05-20 10:00:00', NULL),
(2, 'Karim Mansouri', 'karim.client@gmail.com', 'Probleme de connexion', 'Je n arrive pas a me connecter depuis ce matin.', 'traite', '2026-05-21 11:30:00', '2026-05-21 15:00:00'),
(3, 'Mourad Benali', 'mourad.plombier@gmail.com', 'Probleme avec un avis', 'Je souhaite signaler un avis que je trouve incomplet.', 'nouveau', '2026-05-22 09:15:00', NULL),
(4, 'Nadia Belaid', 'nadia.client@gmail.com', 'Compte bloque', 'Je veux comprendre pourquoi un compte peut etre bloque sur Taskly.', 'traite', '2026-05-23 16:40:00', '2026-05-24 09:10:00'),
(5, 'Amel Cherif', 'amel.client@gmail.com', 'Bug sur le site', 'Le bouton de suivi ne s affiche pas correctement sur mon navigateur.', 'nouveau', '2026-05-25 14:25:00', NULL),
(6, 'Omar Cherif', 'omar.climatisation@gmail.com', 'Autre', 'Je souhaite proposer une amelioration pour mon espace artisan.', 'traite', '2026-05-26 17:50:00', '2026-05-27 10:00:00'),
(7, 'Souad Boukhalfa', 'souad.client@gmail.com', 'Probleme avec un artisan', 'Je veux savoir comment suivre une demande qui reste sans reponse.', 'nouveau', '2026-06-01 10:30:00', NULL),
(8, 'Mehdi Yahiaoui', 'mehdi.client@gmail.com', 'Probleme avec une demande', 'Je souhaite modifier la date souhaitee apres envoi.', 'traite', '2026-06-02 11:45:00', '2026-06-02 16:00:00'),
(9, 'Imane Bensalem', 'imane.client@gmail.com', 'Probleme de signalement', 'Je ne comprends pas pourquoi le signalement doit etre lie a une demande.', 'nouveau', '2026-06-03 13:20:00', NULL),
(10, 'Kamel Guerfi', 'kamel.jardinage@gmail.com', 'Probleme avec un client', 'Le client a annule apres que je me sois prepare pour l intervention.', 'nouveau', '2026-06-04 09:50:00', NULL),
(11, 'Rabah Hannachi', 'rabah.plomberie@gmail.com', 'Bug sur le site', 'La page artisan met parfois du temps a afficher les demandes.', 'traite', '2026-06-05 15:10:00', '2026-06-05 18:00:00'),
(12, 'Meriem Ziani', 'meriem.client@gmail.com', 'Autre', 'Je veux proposer un service supplementaire dans ma ville.', 'nouveau', '2026-06-06 17:40:00', NULL),
(13, 'Fares Ammar', 'fares.climatisation@gmail.com', 'Probleme avec un avis', 'Je souhaite mieux comprendre comment les avis sont visibles sur mon profil.', 'traite', '2026-06-07 12:30:00', '2026-06-07 17:15:00'),
(14, 'Bilal Ouali', 'bilal.client@gmail.com', 'Compte bloque', 'Je veux savoir comment contacter le support si mon compte est bloque.', 'nouveau', '2026-06-08 19:00:00', NULL);

COMMIT;

-- =========================================================
-- AUTO_INCREMENT
-- =========================================================

ALTER TABLE services AUTO_INCREMENT = 13;
ALTER TABLE users AUTO_INCREMENT = 45;
ALTER TABLE clients AUTO_INCREMENT = 17;
ALTER TABLE artisans AUTO_INCREMENT = 28;
ALTER TABLE demandes AUTO_INCREMENT = 46;
ALTER TABLE avis AUTO_INCREMENT = 23;
ALTER TABLE signalements AUTO_INCREMENT = 14;
ALTER TABLE contacts_support AUTO_INCREMENT = 15;

-- =========================================================
-- VERIFICATIONS RAPIDES
-- =========================================================

SELECT COUNT(*) AS total_services FROM services;
SELECT role, COUNT(*) AS total FROM users GROUP BY role;
SELECT COUNT(*) AS total_clients FROM clients;
SELECT COUNT(*) AS total_artisans FROM artisans;
SELECT statut, COUNT(*) AS total FROM demandes GROUP BY statut;
SELECT COUNT(*) AS total_avis FROM avis;
SELECT COUNT(*) AS total_signalements FROM signalements;
SELECT statut, COUNT(*) AS total FROM contacts_support GROUP BY statut;