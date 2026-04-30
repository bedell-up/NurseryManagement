require('dotenv').config();
const { Plant, PlantVariant, Inventory, Pricing, sequelize } = require('../src/models');

// ─── Availability data from Bloomsday_Availability_Dec2025.pdf ───────────────
// Fields: scientific_name, common_name, plant_type, container_size, qty, wholesale, retail, notes
const AVAILABILITY = [
  // Native Trees and Shrubs
  ['Abies grandis', 'Grand Fir', 'tree', '2 gal', 5, 12.00, 24.00],
  ['Acer circinatum', 'Vine Maple', 'shrub', '1 gal', 18, 10.50, 21.00],
  ['Alnus rubra', 'Red Alder', 'tree', '1 gal', 10, 9.75, 19.50],
  ['Amelanchier alnifolia', 'Saskatoon Berry', 'shrub', '1 gal', 5, 10.50, 21.00],
  ['Amelanchier alnifolia', 'Saskatoon Berry', 'shrub', '3 gal', 3, 16.50, 33.00],
  ['Amelanchier alnifolia', 'Western Serviceberry', 'shrub', 'TBD (grafting)', 50, 2.55, 5.10, 'For grafting - Early Spring 26'],
  ['Arbutus menziesii', 'Madrone', 'tree', '1 gal', 1, 15.00, 30.00],
  ['Arbutus menziesii', 'Madrone', 'tree', '2 gal', 5, 22.50, 45.00],
  ['Arctostaphylos uva-ursi', 'Kinnickinick', 'shrub', '1 gal', 100, 6.00, 12.00],
  ['Betula glandulosa', 'Bog Birch', 'shrub', '2 gal', 5, 12.00, 24.00],
  ['Calocedrus decurrens', 'Incense Cedar', 'tree', '2 gal', 4, 10.50, 21.00],
  ['Calycanthus occidentalis', 'Western Spicebush', 'shrub', '5 gal', 3, 24.00, 48.00],
  ['Ceanothus cuneatus', 'Buck Brush', 'shrub', '1 gal', 7, 9.00, 18.00],
  ['Ceanothus cuneatus', 'Buck Brush', 'shrub', '2 gal', 2, 15.00, 30.00],
  ['Chamaecyparis nootkatensis', 'Nootka Cypress', 'tree', '2 gal', 4, 13.50, 27.00],
  ['Cornus nuttallii', 'Pacific Dogwood', 'tree', '3x9 inch band', 10, 9.00, 18.00],
  ['Cornus nuttallii', 'Pacific Dogwood', 'tree', '1 gal', 3, 0.00, 0.00],
  ['Cornus sericea ssp. sericea', 'Red-Osier Dogwood', 'shrub', '1 gal', 15, 4.50, 9.00],
  ['Corylus cornuta', 'Beaked Hazel', 'shrub', '1 gal', 15, 12.75, 25.50],
  ['Crataegus douglasii', 'Douglas Hawthorn', 'tree', '2 gal', 8, 6.00, 12.00],
  ['Crataegus gaylussacia', 'Black Hawthorn', 'tree', 'TBD (grafting)', 50, 2.25, 4.50, 'For grafting - Late Spring 26'],
  ['Ericameria nauseosa', 'Rabbit Brush', 'shrub', '1 gal', 5, 6.75, 13.50],
  ['Euonymus occidentalis', 'Western Wahoo', 'shrub', '1 gal', 10, 12.75, 25.50],
  ['Garrya elliptica', 'Silk Tassel', 'shrub', '1 gal', 10, 10.50, 21.00],
  ['Gaultheria shallon', 'Salal', 'shrub', '4 inch', 27, 3.75, 7.50],
  ['Holodiscus discolor', 'Ocean Spray', 'shrub', '1 gal', 20, 4.88, 9.75],
  ['Juglans hindsii x nigra', 'Oregon Black Walnut', 'tree', 'TBD', 50, 6.00, 12.00, 'Early Spring 26 / Late Spring 26'],
  ['Lonicera involucrata', 'Twinberry', 'shrub', '1 gal', 8, 7.50, 15.00],
  ['Lonicera involucrata', 'Black Twinberry', 'shrub', 'TBD (grafting)', 50, 2.25, 4.50, 'Early Spring 26 / Late Spring 26'],
  ['Malus fusca', 'Pacific Crab Apple', 'tree', '2 gal', 2, 4.88, 9.75],
  ['Malus fusca', 'Western Crabapple', 'tree', 'TBD (grafting)', 50, 2.25, 4.50, 'For grafting - Early Spring 26'],
  ['Oemleria cerasiformis', 'Oso Berry', 'shrub', '5 gal', 1, 37.50, 75.00],
  ['Oemleria cerasiformis', 'Oso Berry', 'shrub', '2 gal', 5, 18.00, 36.00],
  ['Oemleria cerasiformis', 'Osoberry', 'shrub', 'TBD', 50, 2.55, 5.10, 'Early Spring 26 / Late Spring 26'],
  ['Philadelphus lewisii', 'Mock Orange', 'shrub', '2 gal', 9, 9.75, 19.50],
  ['Philadelphus lewisii', 'Mock Orange', 'shrub', '5 gal', 0, 20.00, 40.00],
  ['Physocarpus capitatus', 'Pacific Ninebark', 'shrub', '1 gal', 4, 7.50, 15.00],
  ['Physocarpus capitatus', 'Pacific Ninebark', 'shrub', '5 gal', 5, 19.50, 39.00],
  ['Pinus ponderosa var. ponderosa', 'Ponderosa Pine (Willamette Valley)', 'tree', '5 gal', 3, 22.50, 45.00],
  ['Pinus ponderosa var. ponderosa', 'Ponderosa Pine (Willamette Valley)', 'tree', '2 gal', 4, 10.50, 21.00],
  ['Pinus ponderosa var. ponderosa', 'Ponderosa Pine (Willamette Valley)', 'tree', '3 gal', 1, 15.00, 30.00],
  ['Populus tremuloides', 'Quaking Aspen', 'tree', '5 gal', 5, 25.50, 51.00],
  ['Populus trichocarpa', 'Black Cottonwood', 'tree', '5 gal', 6, 18.00, 36.00],
  ['Populus trichocarpa', 'Black Cottonwood', 'tree', '3 gal', 6, 15.00, 30.00],
  ['Potentilla fruticosa', 'Shrubby Cinquefoil', 'shrub', '1 gal', 5, 5.25, 10.50],
  ['Prunus andersonii', 'Desert Peach', 'shrub', '1 gal', 5, 12.00, 24.00],
  ['Prunus emarginata', 'Bitter Cherry', 'tree', '1 gal', 10, 9.75, 19.50],
  ['Prunus subcordata', 'Klamath Plum', 'tree', '1 gal', 3, 15.00, 30.00],
  ['Prunus virginiana', 'Chokecherry', 'shrub', '2 gal', 8, 9.75, 19.50],
  ['Pseudotsuga menziesii', 'Douglas Fir', 'tree', '2 gal', 2, 10.50, 21.00],
  ['Pseudotsuga menziesii', 'Douglas Fir', 'tree', '5 gal', 5, 22.50, 45.00],
  ['Quercus garryana', 'Oregon White Oak', 'tree', 'TBD', 50, 2.55, 5.10, 'Early Spring 26 / Late Spring 26'],
  ['Frangula purshiana', 'Cascara', 'tree', '1 gal', 4, 8.25, 16.50],
  ['Frangula purshiana', 'Cascara', 'tree', '5 gal', 8, 25.50, 51.00],
  ['Frangula purshiana', 'Cascara (premium)', 'tree', '1 gal', 5, 12.00, 24.00],
  ['Rhus glabra', 'Smooth Sumac', 'shrub', '1 gal', 8, 5.63, 11.25],
  ['Rhus trilobata', 'Fragrant Sumac', 'shrub', '1 gal', 4, 6.38, 12.75],
  ['Ribes aureum', 'Golden Currant', 'shrub', '1 gal', 7, 5.63, 11.25],
  ['Ribes aureum', 'Golden Currant', 'shrub', '3 gal', 3, 16.50, 33.00],
  ['Ribes bracteosum', 'Stink Currant', 'shrub', '3 gal', 12, 12.00, 24.00],
  ['Ribes divaricatum', 'Spreading Gooseberry', 'shrub', '1 gal', 2, 7.50, 15.00],
  ['Ribes divaricatum', 'Spreading Gooseberry', 'shrub', '2 gal', 9, 10.50, 21.00],
  ['Ribes nevadensis', 'Sierra Currant', 'shrub', '1 gal', 5, 10.50, 21.00],
  ['Ribes nevadensis', 'Sierra Currant', 'shrub', '3 gal', 2, 12.00, 24.00],
  ['Ribes sanguineum', 'Red Flowering Currant', 'shrub', '1 gal', 4, 9.75, 19.50],
  ['Ribes sanguineum', 'Red Flowering Currant', 'shrub', '2 gal', 2, 10.50, 21.00],
  ['Ribes sanguineum', 'Red Flowering Currant', 'shrub', 'TBD', 50, 2.25, 4.50, 'Early Spring 26 / Late Spring 26'],
  ['Rosa gymnocarpa', 'Dwarf Rose', 'shrub', '3 gal', 5, 18.00, 36.00],
  ['Rosa nutkana', 'Nootka Rose', 'shrub', '1 gal', 8, 7.00, 14.00],
  ['Rosa pisocarpa', 'Cluster Swamp Rose', 'shrub', '2 gal', 5, 9.38, 18.75],
  ['Rubus parviflorus', 'Thimbleberry', 'shrub', '1 gal', 2, 4.50, 9.00],
  ['Rubus parviflorus', 'Thimbleberry', 'shrub', '2 gal', 10, 10.00, 20.00],
  ['Rubus spectabilis', 'Salmonberry', 'shrub', '3 gal', 3, 15.00, 30.00],
  ['Salix scouleriana', 'Scoulers Willow', 'shrub', '2 gal', 5, 9.38, 18.75],
  ['Sambucus caerulea', 'Blue Elderberry', 'shrub', '1 gal', 6, 5.63, 11.25],
  ['Sambucus caerulea', 'Blue Elderberry', 'shrub', '3 gal', 2, 7.50, 15.00],
  ['Sambucus racemosa', 'Red Elderberry', 'shrub', '1 gal', 6, 4.88, 9.75],
  ['Sequoia sempervirens', 'Coast Redwood', 'tree', '5 gal', 3, 24.00, 48.00],
  ['Spiraea densiflora', 'Rose Meadowsweet', 'shrub', '1 gal', 14, 7.00, 14.00],
  ['Spiraea douglasii', 'Douglas Spirea', 'shrub', '1 gal', 11, 4.50, 9.00],
  ['Symphoricarpos albus', 'Common Snowberry', 'shrub', '1 gal', 46, 4.50, 9.00],
  ['Thuja plicata', 'Western Red Cedar', 'tree', '5 gal', 5, 22.50, 45.00],
  ['Tsuga heterophylla', 'Western Hemlock', 'tree', '5 gal', 5, 27.00, 54.00],
  ['Tsuga mertensiana', 'Mountain Hemlock', 'tree', '5 gal', 3, 51.00, 102.00],
  ['Vaccinium membranaceum', 'Thin Leaf Huckleberry', 'shrub', '1 gal', 10, 12.00, 24.00],
  ['Vaccinium ovalifolium', 'Oval Leaf Huckleberry', 'shrub', '2 gal', 17, 22.50, 45.00],
  ['Viburnum ellipticum', 'Oregon Viburnum', 'shrub', '1 gal', 10, 9.75, 19.50],

  // Native Bulbs and Forbs
  ['Achillea millefolium', 'Yarrow', 'perennial', '1 gal', 4, 6.00, 12.00],
  ['Achillea millefolium', 'Yarrow', 'perennial', '4 inch', 54, 3.00, 6.00],
  ['Adiantum aleuticum', 'Maiden Hair Fern', 'fern', '1 gal', 5, 6.75, 13.50],
  ['Adiantum pedatum', 'Maiden Hair Fern', 'fern', '1 gal', 5, 6.75, 13.50],
  ['Allium acuminatum', 'Tapertip Onion', 'bulb', '4 inch', 0, 3.00, 6.00, 'Early Spring 26'],
  ['Allium acuminatum', 'Tapertip Onion', 'bulb', 'plug tray 50', 1, 150.00, 300.00, 'Early Spring 26'],
  ['Allium amplectens', 'Thinleaf Onion', 'bulb', '4 inch', 0, 3.00, 6.00, 'Early Spring 26'],
  ['Allium amplectens', 'Thinleaf Onion', 'bulb', 'plug tray 50', 1, 150.00, 300.00, 'Early Spring 26'],
  ['Allium cernuum', 'Nodding Onion', 'bulb', '4 inch', 0, 3.00, 6.00, 'Early Spring 26'],
  ['Allium cernuum', 'Nodding Onion', 'bulb', 'plug tray 50', 1, 150.00, 300.00, 'Early Spring 26'],
  ['Anaphalis margaritacea', 'Western Pearly Everlasting', 'perennial', '4 inch', 50, 4.00, 7.00, 'Early Spring 26'],
  ['Aquilegia formosa', 'Western Columbine', 'perennial', '4 inch', 50, 4.00, 7.00, 'Early Spring 26'],
  ['Argentina anserina', 'Pacific Silverweed', 'perennial', '4 inch', 7, 6.00, 12.00],
  ['Artemisia douglasiana', 'California Mugwort', 'perennial', '1 gal', 5, 6.00, 12.00],
  ['Aruncus dioicus', 'Goats Beard', 'perennial', '4 inch', 24, 3.00, 6.00],
  ['Asclepias speciosa', 'Showy Milkweed', 'perennial', '4 inch', 17, 3.00, 6.00],
  ['Blechnum spicant', 'Deer Fern', 'fern', '1 gal', 7, 6.38, 12.75],
  ['Boykinia major', 'Showy Boykinia', 'perennial', '4 inch', 18, 3.00, 6.00],
  ['Brodiaea elegans', 'Harvest Brodiaea', 'bulb', '4 inch', 0, 3.00, 6.00, 'Early Spring 26'],
  ['Brodiaea elegans', 'Harvest Brodiaea', 'bulb', 'plug tray 50', 1, 150.00, 300.00, 'Early Spring 26'],
  ['Camassia leichtlinii ssp. suksdorfii', 'Camas', 'bulb', '4 inch', 29, 4.00, 8.00],
  ['Delphinium trolliifolium', 'Columbian Larkspur', 'perennial', '4 inch', 18, 3.38, 6.75],
  ['Dichelostemma congestum', 'Ookow', 'bulb', '4 inch', 0, 3.00, 6.00, 'Early Spring 26'],
  ['Dichelostemma congestum', 'Ookow', 'bulb', 'plug tray 50', 1, 150.00, 300.00, 'Early Spring 26'],
  ['Epilobium angustifolium', 'Fireweed', 'perennial', '1 gal', 12, 6.00, 12.00],
  ['Erigeron glaucus', 'Beach Daisy', 'perennial', '4 inch', 18, 3.00, 6.00],
  ['Eriophyllum lanatum', 'Oregon Sunshine', 'perennial', '4 inch', 13, 3.00, 6.00],
  ['Fragaria chiloensis', 'Beach Strawberry', 'groundcover', '4 inch', 36, 2.25, 4.50],
  ['Fragaria virginiana', 'Wild Strawberry', 'groundcover', '4 inch', 26, 2.25, 4.50],
  ['Gaillardia aristata', 'Blanket Flower', 'perennial', '1 gal', 9, 5.25, 10.50],
  ['Geranium oreganum', 'Western Geranium', 'perennial', '1 gal', 50, null, null, 'Late Spring 26'],
  ['Grindelia integrifolia', 'Willamette Valley Gumweed', 'perennial', '1 gal', 6, 6.00, 12.00],
  ['Grindelia stricta', 'Coastal Gumweed', 'perennial', '4 inch', 6, 4.50, 9.00],
  ['Heuchera chlorantha', 'Green Flowered Alumroot', 'perennial', '1 gal', 2, 7.50, 15.00],
  ['Iris tenax', 'Oregon Iris', 'perennial', 'TBD', 50, null, null, 'Late Spring 26'],
  ['Lewisia rediviva', 'Bitter Root', 'perennial', '4 inch', 14, 6.00, 12.00, 'Early Spring 26'],
  ['Lomatium dissectum', 'Fernleaf Biscuitroot', 'perennial', '4 inch mid band', 25, 3.05, 6.09, 'Late Spring 26'],
  ['Lupinus polyphyllus', 'Big-leaf Lupine', 'perennial', '4 inch', 21, 3.50, 7.00],
  ['Maianthemum stellatum', 'Star-Flowered Solomons Seal', 'perennial', 'TBD', 50, null, null, 'Late Spring 26'],
  ['Montia parvifolia', 'Littleleaf Montia', 'perennial', '2 3/8 inch', 18, 3.00, 6.00],
  ['Oreostemma alpigenum', 'Alpine Aster', 'perennial', '4 inch', 10, 6.00, 12.00, 'Early Spring 26'],
  ['Polypodium glycyrrhiza', 'Liquorice Fern', 'fern', '1 gal', 3, 7.50, 15.00],
  ['Polystichum munitum', 'Sword Fern', 'fern', '1 gal', 13, 6.00, 12.00],
  ['Polystichum munitum', 'Sword Fern', 'fern', '7 gal', 1, 22.50, 45.00],
  ['Polystichum munitum', 'Western Sword Fern', 'fern', 'TBD', 50, null, null, 'Late Spring 26 / Early Spring 26'],
  ['Potentilla gracilis', 'Graceful Cinquefoil', 'perennial', '4 inch', 6, 4.50, 9.00],
  ['Prunella vulgaris ssp. lanceolata', 'Self Heal', 'perennial', '4 inch', 9, 2.78, 5.55],
  ['Sagittaria latifolia', 'Wapato', 'aquatic', '4 inch', 50, 3.00, 6.00, 'Early Spring 26'],
  ['Sagittaria latifolia', 'Wapato', 'aquatic', 'plug tray 50', 1, 150.00, 300.00, 'Early Spring 26'],
  ['Scrophularia californica', 'California Figwort', 'perennial', 'TBD', 50, null, null, 'Late Spring 26'],
  ['Sedum oreganum', 'Oregon Stonecrop', 'perennial', '4 inch', 2, 3.75, 7.50],
  ['Sedum spathulifolium', 'Broadleaf Stonecrop', 'perennial', '4 inch', 7, 3.75, 7.50],
  ['Sidalcea nelsoniana', "Nelson's Checkermallow", 'perennial', 'TBD', 50, null, null, 'Late Spring 26'],
  ['Sisyrinchium californicum', 'Yellow-eyed Grass', 'perennial', '1 gal', 3, 7.50, 15.00],
  ['Sisyrinchium idahoense', 'Blue Eyed Grass', 'perennial', '4 inch', 18, 3.00, 6.00, 'Early Spring 26'],
  ['Solidago elongata', 'Goldenrod', 'perennial', 'TBD', 50, null, null, 'Late Spring 26'],
  ['Tolmiea menziesii', 'Piggy Back Plant', 'perennial', '4 inch', 0, 3.00, 6.00],
  ['Triteleia hyacinthina', 'White Brodiaea', 'bulb', '4 inch', 0, 3.00, 6.00, 'Early Spring 26'],
  ['Triteleia hyacinthina', 'White Brodiaea', 'bulb', 'plug tray 50', 1, 150.00, 300.00, 'Early Spring 26'],

  // Native Graminoids
  ['Bromus vulgaris', 'Columbia Brome', 'grass', '1 gal', 5, 6.00, 12.00],
  ['Bromus vulgaris', 'Columbia Brome', 'grass', '4 inch', 18, 6.00, 12.00],
  ['Carex amplifolia', 'Big-leaf Sedge', 'grass', '1 gal', 11, 6.00, 12.00],
  ['Carex leptopoda', 'Slender Footed Sedge', 'grass', '2 7/8 inch band', 24, 6.00, 12.00],
  ['Carex leptopoda', 'Slender Footed Sedge', 'grass', '4 inch', 12, 6.00, 12.00],
  ['Carex mertensii', "Merten's Sedge", 'grass', '4 inch', 72, 1.50, 3.00, 'Early Spring 26'],
  ['Carex microptera', 'Winged Sedge', 'grass', '1 gal', 6, 7.50, 15.00],
  ['Carex obnupta', 'Slough Sedge', 'grass', '1 gal', 26, 6.00, 12.00],
  ['Carex pachystachya', 'Chamisso Sedge', 'grass', '2 7/8 inch', 70, 3.50, 7.00, 'Late Spring 26'],
  ['Carex vulpinoidea', 'Fox Sedge', 'grass', 'TBD', 50, null, null, 'Early Spring 26 / Late Spring 26'],
  ['Deschampsia cespitosa', 'Tufted Hair Grass', 'grass', '4 inch', 0, 3.00, 6.00],
  ['Elymus glaucus', 'Blue Wild Rye', 'grass', '4 inch', 13, 6.00, 12.00],
  ['Festuca idahoensis ssp. roemeri', 'Roemers Fescue', 'grass', '1 gal', 5, 4.50, 9.00],
  ['Glyceria striata', 'Tall Manna Grass', 'grass', '4 inch', 18, 6.00, 12.00],
  ['Juncus effusus', 'Common Rush', 'grass', '4 inch', 2, 6.00, 12.00],
  ['Juncus effusus var. pacificus', 'Soft Rush', 'grass', 'TBD', 50, null, null, 'Early Spring 26 / Late Spring 26'],
  ['Juncus ensifolius', 'Dagger Leaf Rush', 'grass', '4 inch', 54, 2.25, 4.50],
  ['Juncus occidentalis', 'Western Rush', 'grass', '4 inch', 0, 3.00, 6.00],
  ['Leymus mollis', 'Beach Dune Grass', 'grass', '1 gal', 3, 6.00, 12.00],
  ['Leymus triticoides', 'Creeping Wild Rye', 'grass', '4 inch', 72, 1.50, 3.00, 'Early Spring 26'],
  ['Melica harfordii', "Harford's Onion Grass", 'grass', '1 gal', 6, 6.00, 12.00],
  ['Poa secunda', 'Pine Blue Grass', 'grass', '4 inch', 4, 2.00, 6.00, 'Late Spring 26'],
  ['Scirpus acutus', 'Hardstem Bulrush', 'aquatic', '4 inch', 72, 1.50, 3.00, 'Early Spring 26'],
  ['Stipa lemmonii', 'Lemmons Needle Grass', 'grass', '1 gal', 0, 6.00, 12.00, 'Late Spring 26'],

  // Non-native
  ['Ribes nidigrolaria', 'Josta Berry', 'shrub', '3 gal', 5, 18.00, 36.00],
  ['Punica granatum', 'Pomegranate', 'shrub', '1 gal', 2, 12.00, 24.00],

  // Perennial Veg
  ['Allium fistulosum', 'Welsh Onion', 'perennial', '4 inch', 18, 6.00, 12.00],
  ['Allium fistulosum', 'Welsh Onion', 'perennial', '1 gal', 4, 6.00, 12.00],
  ['Apium graveolens', 'Pink Plume Celery', 'perennial', '4 inch', 10, 6.00, 12.00],
  ['Cryptotaenia japonica', 'Mitsuba', 'perennial', '1 gal', 4, 6.00, 12.00],
  ['Fagopyrum dibotrys', 'Perennial Buckwheat', 'perennial', '1 gal', 54, 6.00, 12.00],
  ['Hablitzia tamnoides', 'Caucasian Spinach', 'perennial', '4 inch', 10, 6.00, 12.00],
  ['Hablitzia tamnoides', 'Caucasian Spinach', 'perennial', '1 gal', 12, 6.00, 12.00],
  ['Rudbeckia laciniata', 'Sochan', 'perennial', '1 gal', 3, 6.00, 12.00],
  ['Sium sisarum', 'Skirret', 'perennial', '1 gal', 3, 6.00, 12.00],
  ['Sium sisarum', 'Skirret', 'perennial', '4 inch', 18, 6.00, 12.00],
];

// ─── Incoming orders from BLOOMSDAY INCOMING FEB 2026 ────────────────────────
// Fields: scientific_name, common_name, plant_type, container_size, qty_incoming, source
const INCOMING = [
  // Beaver Lake - Container
  ['Allium cernuum', 'Nodding Onion', 'bulb', '3.5 inch', 50, 'Beaver Lake'],
  ['Achillea millefolium', 'Yarrow', 'perennial', '3.5 inch', 100, 'Beaver Lake'],
  ['Camassia quamash', 'Common Camas', 'bulb', '3.5 inch', 100, 'Beaver Lake'],
  ['Camassia leichtlinii', 'Camas', 'bulb', '3.5 inch', 50, 'Beaver Lake'],
  ['Eriophyllum lanatum', 'Oregon Sunshine', 'perennial', '3.5 inch', 25, 'Beaver Lake'],
  ['Festuca idahoensis ssp. roemeri', 'Roemers Fescue', 'grass', '3.5 inch', 100, 'Beaver Lake'],
  ['Maianthemum racemosum', 'False Solomons Seal', 'perennial', '1 gal', 10, 'Beaver Lake'],
  ['Quercus garryana', 'Oregon White Oak', 'tree', '1 gal', 5, 'Beaver Lake'],
  ['Tellima grandiflora', 'Fringecup', 'perennial', '3.5 inch', 25, 'Beaver Lake'],
  // Beaver Lake - Bare Root
  ['Mahonia nervosa', 'Longleaf Mahonia', 'shrub', 'bare root 6 inch', 100, 'Beaver Lake'],
  ['Mahonia repens', 'Creeping Mahonia', 'shrub', 'bare root 6 inch', 100, 'Beaver Lake'],
  ['Rosa pisocarpa', 'Cluster Swamp Rose', 'shrub', 'bare root 15 inch+', 100, 'Beaver Lake'],
  ['Philadelphus lewisii', 'Mock Orange', 'shrub', 'bare root 15 inch', 100, 'Beaver Lake'],
  ['Rubus parviflorus', 'Thimbleberry', 'shrub', 'bare root 15 inch', 100, 'Beaver Lake'],
  // Champoeg - Potted
  ['Aquilegia formosa', 'Western Columbine', 'perennial', '4 inch', 36, 'Champoeg'],
  ['Camassia leichtlinii var. suksdorfii', 'Camas', 'bulb', '3.5 inch', 36, 'Champoeg'],
  ['Corydalis scouleri', 'Scoulers Corydalis', 'perennial', '1 gal', 15, 'Champoeg'],
  ['Koeleria macrantha', 'Prairie Junegrass', 'grass', '3.5 inch', 50, 'Champoeg'],
  ['Mertensia subcordata', 'Bluebell', 'perennial', '1 gal', 10, 'Champoeg'],
  ['Mimulus guttatus', 'Yellow Monkeyflower', 'perennial', '3.5 inch', 25, 'Champoeg'],
  ['Sidalcea campestris', 'Meadow Checkermallow', 'perennial', '3.5 inch', 25, 'Champoeg'],
  ['Sidalcea hendersonii', 'Henderson Sidalcea', 'perennial', '3.5 inch', 25, 'Champoeg'],
  ['Tiarella trifoliata', 'Foamflower', 'perennial', '3.5 inch', 25, 'Champoeg'],
  ['Vancouveria hexandra', 'Inside-out Flower', 'perennial', '3.5 inch', 25, 'Champoeg'],
  // Champoeg - Bare Root
  ['Polystichum munitum', 'Sword Fern', 'fern', 'bare root', 50, 'Champoeg'],
  ['Mahonia aquifolium', 'Oregon Grape', 'shrub', 'bare root 24-36 inch', 50, 'Champoeg'],
  ['Ribes sanguineum', 'Red Flowering Currant', 'shrub', 'bare root 18-24 inch', 50, 'Champoeg'],
  ['Rosa woodsii', 'Woods Rose', 'shrub', 'bare root 12-18 inch', 50, 'Champoeg'],
  // Seven Oaks - Bare Root
  ['Ribes aureum', 'Golden Currant', 'shrub', 'bare root', 50, 'Seven Oaks'],
  ['Cornus sericea', 'Red-Osier Dogwood', 'shrub', 'bare root', 25, 'Seven Oaks'],
  ['Symphoricarpos albus', 'Common Snowberry', 'shrub', 'bare root', 100, 'Seven Oaks'],
  // Scholls Valley - Bare Root
  ['Anaphalis margaritacea', 'Western Pearly Everlasting', 'perennial', 'bare root', 50, 'Scholls Valley'],
  ['Aquilegia formosa', 'Western Columbine', 'perennial', 'bare root', 50, 'Scholls Valley'],
  ['Carex vulpinoidea', 'Fox Sedge', 'grass', 'bare root', 50, 'Scholls Valley'],
  ['Eriophyllum lanatum', 'Oregon Sunshine', 'perennial', 'bare root', 50, 'Scholls Valley'],
  ['Geranium oreganum', 'Western Geranium', 'perennial', 'bare root', 50, 'Scholls Valley'],
  ['Iris tenax', 'Oregon Iris', 'perennial', 'bare root', 50, 'Scholls Valley'],
  ['Juncus effusus var. pacificus', 'Soft Rush', 'grass', 'bare root', 50, 'Scholls Valley'],
  ['Maianthemum stellatum', 'Star-Flowered Solomons Seal', 'perennial', 'bare root', 50, 'Scholls Valley'],
  ['Scrophularia californica', 'California Figwort', 'perennial', 'bare root', 50, 'Scholls Valley'],
  ['Sidalcea nelsoniana', "Nelson's Checkermallow", 'perennial', 'bare root', 50, 'Scholls Valley'],
  ['Amelanchier alnifolia', 'Western Serviceberry', 'shrub', 'bare root', 50, 'Scholls Valley'],
  ['Crataegus gaylussacia', 'Black Hawthorn', 'tree', 'bare root', 50, 'Scholls Valley'],
  ['Juglans hindsii x nigra', 'Oregon Black Walnut', 'tree', 'bare root', 50, 'Scholls Valley'],
  ['Lonicera involucrata', 'Black Twinberry', 'shrub', 'bare root', 50, 'Scholls Valley'],
  ['Malus fusca', 'Western Crabapple', 'tree', 'bare root', 50, 'Scholls Valley'],
  ['Oemleria cerasiformis', 'Osoberry', 'shrub', 'bare root', 50, 'Scholls Valley'],
  ['Polystichum munitum', 'Western Sword Fern', 'fern', 'bare root', 50, 'Scholls Valley'],
  ['Quercus garryana', 'Oregon White Oak', 'tree', 'bare root', 50, 'Scholls Valley'],
  ['Ribes sanguineum', 'Red Flowering Currant', 'shrub', 'bare root', 50, 'Scholls Valley'],
  ['Wyethia angustifolia', 'Narrowleaf Mule Ears', 'perennial', 'bare root', 50, 'Scholls Valley'],
];

// ─── Seeding list from Bloomsday_SeedingList_2026.pdf ────────────────────────
// Fields: scientific_name, common_name, plant_type, box, location
const SEEDS = [
  // Box 1
  ['Artemisia suksdorfii', 'Suksdorf Mugwort', 'perennial', 'Box 1', 'unknown'],
  ['Boykinia major', 'Showy Boykinia', 'perennial', 'Box 1', 'Pardee'],
  ['Campanula rotundifolia', 'Bluebell', 'perennial', 'Box 1', 'Pardee'],
  ['Castilleja levisecta', 'Golden Paintbrush', 'perennial', 'Box 1', 'Tualitin WLR'],
  ['Cerastium arvense', 'Field Chickweed', 'perennial', 'Box 1', 'Lorna Buffalo Fast'],
  ['Collomia grandiflora', 'Large-Flowered Collomia', 'annual', 'Box 1', 'Pardee'],
  ['Coreopsis tinctoria', 'Plains Coreopsis', 'annual', 'Box 1', 'Pardee'],
  ['Deschampsia elongata', 'Slender Hairgrass', 'grass', 'Box 1', 'Plural'],
  ['Deschampsia elongata', 'Slender Hairgrass', 'grass', 'Box 1', 'Pardee'],
  ['Erigeron divergens', 'Spreading Fleabane', 'perennial', 'Box 1', 'Pardee'],
  ['Erigeron peregrinus', 'Subalpine Daisy', 'perennial', 'Box 1', 'Pardee'],
  ['Erigeron speciosus', 'Showy Fleabane', 'perennial', 'Box 1', 'Pardee'],
  ['Eurybia radulina', 'Roughleaf Aster', 'perennial', 'Box 1', 'Prime Forest'],
  ['Gilia capitata', 'Globe Gilia', 'annual', 'Box 1', 'City Portland restoration'],
  ['Grindelia stricta', 'Coastal Gumweed', 'perennial', 'Box 1', 'Uplands, Vic, BC'],
  ['Heterotheca villosa', 'Hairy False Goldenaster', 'perennial', 'Box 1', 'Pardee'],
  ['Lomatium dissectum', 'Fernleaf Biscuitroot', 'perennial', 'Box 1', 'Tualitin WLR'],
  ['Madia elegans', 'Common Madia', 'annual', 'Box 1', 'Pardee'],
  ['Monardella odoratissima', 'Mountain Monardella', 'perennial', 'Box 1', 'Pardee'],
  ['Nothochelone nemorosa', 'Woodland Penstemon', 'perennial', 'Box 1', 'Pardee'],
  ['Scrophularia californica', 'California Figwort', 'perennial', 'Box 1', 'Pardee'],
  ['Penstemon hesperius', 'Evening Penstemon', 'perennial', 'Box 1', 'Pardee'],
  ['Phacelia hastata', 'Silverleaf Phacelia', 'perennial', 'Box 1', 'Pardee'],
  ['Potentilla gracilis', 'Graceful Cinquefoil', 'perennial', 'Box 1', 'Pardee'],
  ['Sidalcea cusickii', 'Cusick Sidalcea', 'perennial', 'Box 1', 'Pardee'],
  ['Sidalcea hendersonii', 'Henderson Sidalcea', 'perennial', 'Box 1', 'Pardee'],
  ['Sanicula crassicaulis', 'Pacific Sanicle', 'perennial', 'Box 1', 'Uplands, Vic, BC'],
  ['Lomatium nudicaule', 'Barestem Lomatium', 'perennial', 'Box 1', 'Uplands, Vic, BC'],
  ['Lupinus micranthus', 'Gully Lupine', 'annual', 'Box 1', 'Willamette Wildlings'],
  ['Anemone multifida', 'Pacific Anemone', 'perennial', 'Box 1', 'Ghost Flower Grange'],
  ['Drosera rotundifolia', 'Broadleaf Sundew', 'perennial', 'Box 1', 'Ghost Flower Grange'],
  ['Silene douglasii ssp. douglasii', "Douglas's Catchfly", 'perennial', 'Box 1', 'Ghost Flower Grange'],
  ['Arabis eschscholtziana', 'Pacific Rockcress', 'perennial', 'Box 1', 'Ghost Flower Grange'],
  ['Vicia nigricans ssp. gigantea', 'Giant Black Vetch', 'perennial', 'Box 1', 'Ghost Flower Grange'],
  // Box 2
  ['Actaea rubra', 'Red Baneberry', 'perennial', 'Box 2', 'N. Trash River'],
  ['Angelica arguta', 'Sharptooh Angelica', 'perennial', 'Box 2', 'Pardee'],
  ['Anisocarpus madioides', 'Woodland Tarweed', 'annual', 'Box 2', 'Northern California'],
  ['Bidens frondosa', 'Devils Beggar-ticks', 'annual', 'Box 2', 'Kelso - Lake Dorothy'],
  ['Canadanthus modestus', 'Modesty Aster', 'perennial', 'Box 2', 'Tillamook Trash River'],
  ['Carex hendersonii', 'Henderson Sedge', 'grass', 'Box 2', 'Plural'],
  ['Carex leptopoda', 'Slender Footed Sedge', 'grass', 'Box 2', 'Plural'],
  ['Carex microptera', 'Winged Sedge', 'grass', 'Box 2', 'Plural'],
  ['Ceanothus integerrimus', 'Deerbush', 'shrub', 'Box 2', '5 mile - The Dalles'],
  ['Cirsium occidentale', 'Cobwebby Thistle', 'perennial', 'Box 2', 'Pardee'],
  ['Nicotiana attenuata', 'Coyote Tobacco', 'annual', 'Box 2', 'Pardee'],
  ['Darlingtonia californica', 'Cobra Lily', 'perennial', 'Box 2', '$8 mountain'],
  ['Daucus pusillus', 'Rattlesnake Weed', 'annual', 'Box 2', 'Pardee'],
  ['Erigeron philadelphicus', 'Philadelphia Fleabane', 'perennial', 'Box 2', 'Elk Rock Island'],
  ['Eriophyllum lanatum', 'Oregon Sunshine', 'perennial', 'Box 2', 'Canyon Creek'],
  ['Eurybia radulina', 'Roughleaf Aster', 'perennial', 'Box 2', 'Prime Forest'],
  ['Glyceria grandis', 'American Manna Grass', 'grass', 'Box 2', 'North Trask'],
  ['Heracleum maximum', 'Cow Parsnip', 'perennial', 'Box 2', 'North Fork Trask'],
  ['Heuchera chlorantha', 'Green Flowered Alumroot', 'perennial', 'Box 2', 'Pardee'],
  ['Heuchera micrantha', 'Small-Flowered Alumroot', 'perennial', 'Box 2', 'Pardee'],
  ['Linum lewisii', 'Lewis Flax', 'perennial', 'Box 2', 'Umpqua'],
  ['Lupinus laxiflorus', 'Velvet Lupine', 'perennial', 'Box 2', '5 mile Rd - The Dalles'],
  ['Lomatium nudum', 'Naked Lomatium', 'perennial', 'Box 2', 'Sishyous'],
  ['Lupinus arboreus', 'Yellow Bush Lupine', 'shrub', 'Box 2', 'San Francisco, CA'],
  ['Madia exigua', 'Threadstalk Tarweed', 'annual', 'Box 2', 'Deschutes - Canyon Creek'],
  ['Microseris laciniata', 'Cut-leaf Silverpuffs', 'perennial', 'Box 2', 'Round Lake'],
  ['Oreostemma alpigenum', 'Alpine Aster', 'perennial', 'Box 2', 'Plural'],
  ['Penstemon hesperius', 'Evening Penstemon', 'perennial', 'Box 2', 'Pardee'],
  ['Potentilla gracilis', 'Graceful Cinquefoil', 'perennial', 'Box 2', 'Bosco'],
  ['Solidago elongata', 'Goldenrod', 'perennial', 'Box 2', 'Trask River'],
  ['Stachys rigida', 'Rigid Hedge Nettle', 'perennial', 'Box 2', 'Watershed Nursery'],
  ['Stipa lemmonii', 'Lemmons Needle Grass', 'grass', 'Box 2', 'Plural'],
  // Box 3
  ['Artemisia douglasiana', 'California Mugwort', 'perennial', 'Box 3', 'Sandy River'],
  ['Barbarea orthoceras', 'American Yellowrocket', 'perennial', 'Box 3', 'Satinflower'],
  ['Carex tumulicola', 'Foothill Sedge', 'grass', 'Box 3', 'Willamette Wildings'],
  ['Carex vesicaria', 'Lesser Flat Sedge', 'grass', 'Box 3', 'unknown'],
  ['Ceanothus sanguineus', 'Redstem Ceanothus', 'shrub', 'Box 3', 'NGG'],
  ['Clarkia purpurea ssp. quadrivulnera', 'Winecup Clarkia', 'annual', 'Box 3', 'Willamette Wildings'],
  ['Collomia heterophylla', 'Varied-Leaf Collomia', 'annual', 'Box 3', 'Dianes'],
  ['Epilobium brachycarpum', 'Tall Annual Willowherb', 'annual', 'Box 3', 'Estacada'],
  ['Erigeron glaucus', 'Beach Daisy', 'perennial', 'Box 3', 'Pardee'],
  ['Eriogonum compositum', 'Arrowleaf Buckwheat', 'perennial', 'Box 3', 'Pardee'],
  ['Erigeron speciosus', 'Showy Fleabane', 'perennial', 'Box 3', 'Pardee'],
  ['Geum macrophyllum', 'Large-leaved Avens', 'perennial', 'Box 3', 'Dianes'],
  ['Glyceria elata', 'Tall Manna Grass', 'grass', 'Box 3', 'Inside Passage Seeds'],
  ['Ligusticum apiifolium', 'Celery-leaved Lovage', 'perennial', 'Box 3', 'Willamette Wildings'],
  ['Lomatium dissectum', 'Fernleaf Biscuitroot', 'perennial', 'Box 3', 'Willamette Wildings'],
  ['Lupinus rivularis', 'Streambank Lupine', 'perennial', 'Box 3', 'unknown'],
  ['Penstemon ovatus', 'Egg-leaved Penstemon', 'perennial', 'Box 3', 'Pardee'],
  ['Phacelia nemoralis', 'Shade Phacelia', 'annual', 'Box 3', 'Pardee'],
  ['Sidalcea campestris', 'Meadow Checkermallow', 'perennial', 'Box 3', 'Pardee'],
  ['Viola praemorsa', 'Upland Yellow Violet', 'perennial', 'Box 3', 'Willamette Wildings'],
  ['Sericocarpus oregonensis', 'Oregon White-top Aster', 'perennial', 'Box 3', 'Pardee'],
  // MISC
  ['Thermopsis gracilis', 'Slender Golden Banner', 'perennial', 'MISC', null],
  ['Deschampsia cespitosa', 'Tufted Hair Grass', 'grass', 'MISC', 'Pardee'],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractGenus(sciName) {
  if (!sciName) return null;
  return sciName.split(' ')[0];
}

function extractSpecies(sciName) {
  if (!sciName) return null;
  const parts = sciName.split(' ');
  if (parts.length < 2) return null;
  const s = parts[1];
  if (['x', 'var.', 'ssp.', 'subsp.'].includes(s.toLowerCase())) return null;
  return s;
}

async function upsertPlant(sciName, commonName, plantType, extraNotes) {
  const genus = extractGenus(sciName);
  const species = extractSpecies(sciName);

  const defaults = {
    scientific_name: sciName,
    common_name: commonName,
    genus,
    species,
    plant_type: plantType,
    native_region: plantType !== 'other' && !['Ribes nidigrolaria', 'Punica granatum'].includes(sciName)
      ? 'Pacific Northwest' : null,
    is_active: true,
    is_featured: false,
    notes: extraNotes || null,
  };

  const [plant, created] = await Plant.findOrCreate({
    where: { scientific_name: sciName, common_name: commonName },
    defaults,
  });

  if (!created && extraNotes) {
    // Append notes if not already present
    const existing = plant.notes || '';
    if (!existing.includes(extraNotes)) {
      await plant.update({ notes: existing ? existing + '\n' + extraNotes : extraNotes });
    }
  }

  return { plant, created };
}

async function upsertVariantInventoryPricing(plant, containerSize, qty, wholesale, retail, incomingQty, incomingSource) {
  const [variant] = await PlantVariant.findOrCreate({
    where: { plant_id: plant.id, container_size: containerSize },
    defaults: { plant_id: plant.id, container_size: containerSize, is_active: true },
  });

  if (qty !== null && qty !== undefined) {
    const [inv, invCreated] = await Inventory.findOrCreate({
      where: { variant_id: variant.id },
      defaults: {
        variant_id: variant.id,
        quantity_on_hand: qty,
        quantity_reserved: 0,
        quantity_incoming: incomingQty || 0,
        notes: incomingSource ? `Incoming from: ${incomingSource}` : null,
      },
    });
    if (!invCreated) {
      const updates = { quantity_on_hand: qty };
      if (incomingQty) {
        updates.quantity_incoming = (inv.quantity_incoming || 0) + incomingQty;
        const existingNotes = inv.notes || '';
        const newNote = `Incoming from: ${incomingSource}`;
        updates.notes = existingNotes.includes(newNote) ? existingNotes : (existingNotes ? existingNotes + '\n' + newNote : newNote);
      }
      await inv.update(updates);
    }
  }

  if (retail !== null && retail !== undefined) {
    const [pricing, pricingCreated] = await Pricing.findOrCreate({
      where: { variant_id: variant.id },
      defaults: {
        variant_id: variant.id,
        retail_price: retail || 0,
        wholesale_price: wholesale || null,
        currency: 'USD',
      },
    });
    if (!pricingCreated) {
      await pricing.update({ retail_price: retail || 0, wholesale_price: wholesale || null });
    }
  }

  return variant;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('Connecting to database...');
  await sequelize.authenticate();
  await sequelize.sync({ alter: false });

  const stats = { plants_new: 0, plants_updated: 0, variants: 0, errors: [] };

  // ── 1. Availability data ──────────────────────────────────────────────────
  console.log('\nImporting Bloomsday availability (Dec 2025)...');
  for (const row of AVAILABILITY) {
    const [sciName, commonName, plantType, containerSize, qty, wholesale, retail, notesExtra] = row;
    const notes = ['Source: Bloomsday Natives availability list (Dec 2025)', notesExtra].filter(Boolean).join('\n');
    try {
      const { plant, created } = await upsertPlant(sciName, commonName, plantType, notes);
      created ? stats.plants_new++ : stats.plants_updated++;
      await upsertVariantInventoryPricing(plant, containerSize, qty, wholesale, retail, 0, null);
      stats.variants++;
    } catch (err) {
      stats.errors.push({ section: 'availability', name: `${sciName} (${containerSize})`, error: err.message });
    }
  }

  // ── 2. Incoming orders ────────────────────────────────────────────────────
  console.log('Importing incoming orders (Feb 2026)...');
  for (const row of INCOMING) {
    const [sciName, commonName, plantType, containerSize, qtyIncoming, source] = row;
    const notes = `Source: Bloomsday Natives incoming order (Feb 2026) - ${source}`;
    try {
      const { plant, created } = await upsertPlant(sciName, commonName, plantType, notes);
      created ? stats.plants_new++ : stats.plants_updated++;

      const [variant] = await PlantVariant.findOrCreate({
        where: { plant_id: plant.id, container_size: containerSize },
        defaults: { plant_id: plant.id, container_size: containerSize, is_active: true },
      });

      const [inv, invCreated] = await Inventory.findOrCreate({
        where: { variant_id: variant.id },
        defaults: {
          variant_id: variant.id,
          quantity_on_hand: 0,
          quantity_reserved: 0,
          quantity_incoming: qtyIncoming,
          notes: `Incoming from: ${source}`,
        },
      });
      if (!invCreated) {
        const existingNote = inv.notes || '';
        const newNote = `Incoming from: ${source}`;
        await inv.update({
          quantity_incoming: (inv.quantity_incoming || 0) + qtyIncoming,
          notes: existingNote.includes(newNote) ? existingNote : (existingNote ? existingNote + '\n' + newNote : newNote),
        });
      }
      stats.variants++;
    } catch (err) {
      stats.errors.push({ section: 'incoming', name: `${sciName} (${containerSize})`, error: err.message });
    }
  }

  // ── 3. Seeding list ───────────────────────────────────────────────────────
  console.log('Importing seeding list (2026)...');
  for (const row of SEEDS) {
    const [sciName, commonName, plantType, box, location] = row;
    const notes = `Bloomsday seed collection 2026 - ${box}${location ? ', harvested from: ' + location : ''}`;
    try {
      const { created } = await upsertPlant(sciName, commonName, plantType, notes);
      created ? stats.plants_new++ : stats.plants_updated++;
    } catch (err) {
      stats.errors.push({ section: 'seeds', name: sciName, error: err.message });
    }
  }

  // ── 4. Rebuild search vectors ─────────────────────────────────────────────
  console.log('\nRebuilding full-text search index...');
  await sequelize.query(`
    UPDATE plants SET search_vector = to_tsvector('english',
      coalesce(common_name, '') || ' ' ||
      coalesce(scientific_name, '') || ' ' ||
      coalesce(genus, '') || ' ' ||
      coalesce(native_region, '') || ' ' ||
      coalesce(bloom_time, '') || ' ' ||
      coalesce(landscape_use, '') || ' ' ||
      coalesce(notes, '')
    )
  `);

  console.log('\n=== Bloomsday Import Complete ===');
  console.log(`  New plants:     ${stats.plants_new}`);
  console.log(`  Updated plants: ${stats.plants_updated}`);
  console.log(`  Variants:       ${stats.variants}`);
  console.log(`  Errors:         ${stats.errors.length}`);
  if (stats.errors.length) {
    console.log('\nErrors:');
    stats.errors.forEach(e => console.log(`  [${e.section}] ${e.name}: ${e.error}`));
  }

  await sequelize.close();
}

run().catch(err => { console.error(err); process.exit(1); });
