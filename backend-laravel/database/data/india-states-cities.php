<?php

// States and union territories of India, each with its main cities and
// district towns, for the State / City drop-downs (StateCitySeeder).
// Add a missing town here and re-run:
//   php artisan db:seed --class=StateCitySeeder
// Re-seeding only adds; nothing already in the tables is removed.

return [
    ['name' => 'Andaman and Nicobar Islands', 'code' => 'AN', 'cities' => [
        'Port Blair', 'Car Nicobar', 'Diglipur', 'Mayabunder', 'Rangat',
    ]],
    ['name' => 'Andhra Pradesh', 'code' => 'AP', 'cities' => [
        'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati', 'Rajahmundry', 'Kakinada',
        'Kadapa', 'Anantapur', 'Eluru', 'Ongole', 'Vizianagaram', 'Srikakulam', 'Machilipatnam', 'Chittoor',
        'Proddatur', 'Hindupur', 'Bhimavaram', 'Tenali', 'Amaravati', 'Nandyal', 'Adoni', 'Madanapalle',
        'Guntakal', 'Dharmavaram', 'Gudivada', 'Narasaraopet', 'Tadepalligudem', 'Chilakaluripet', 'Puttaparthi',
    ]],
    ['name' => 'Arunachal Pradesh', 'code' => 'AR', 'cities' => [
        'Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro', 'Bomdila', 'Tezu', 'Along', 'Roing',
        'Namsai', 'Khonsa', 'Daporijo', 'Seppa', 'Changlang',
    ]],
    ['name' => 'Assam', 'code' => 'AS', 'cities' => [
        'Guwahati', 'Dispur', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur', 'Bongaigaon',
        'Dhubri', 'Diphu', 'North Lakhimpur', 'Karimganj', 'Sivasagar', 'Goalpara', 'Barpeta', 'Golaghat',
        'Haflong', 'Kokrajhar', 'Hailakandi', 'Mangaldoi', 'Nalbari', 'Morigaon', 'Dhemaji',
    ]],
    ['name' => 'Bihar', 'code' => 'BR', 'cities' => [
        'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia', 'Arrah', 'Begusarai', 'Katihar',
        'Munger', 'Chapra', 'Sasaram', 'Hajipur', 'Dehri', 'Siwan', 'Motihari', 'Nawada', 'Bettiah',
        'Bihar Sharif', 'Buxar', 'Kishanganj', 'Sitamarhi', 'Jamalpur', 'Jehanabad', 'Aurangabad', 'Madhubani',
        'Samastipur', 'Saharsa', 'Supaul', 'Gopalganj', 'Lakhisarai', 'Khagaria', 'Bodh Gaya',
    ]],
    ['name' => 'Chandigarh', 'code' => 'CH', 'cities' => [
        'Chandigarh',
    ]],
    ['name' => 'Chhattisgarh', 'code' => 'CG', 'cities' => [
        'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon', 'Jagdalpur', 'Raigarh', 'Ambikapur',
        'Dhamtari', 'Mahasamund', 'Chirmiri', 'Kanker', 'Janjgir', 'Kawardha', 'Bemetara', 'Balod',
        'Dantewada', 'Kondagaon', 'Mungeli',
    ]],
    ['name' => 'Dadra and Nagar Haveli and Daman and Diu', 'code' => 'DH', 'cities' => [
        'Daman', 'Diu', 'Silvassa',
    ]],
    ['name' => 'Delhi', 'code' => 'DL', 'cities' => [
        'New Delhi', 'Delhi', 'Dwarka', 'Rohini', 'Saket', 'Karol Bagh', 'Connaught Place', 'Lajpat Nagar',
        'Janakpuri', 'Pitampura', 'Narela', 'Shahdara', 'Mayur Vihar', 'Vasant Kunj', 'Chandni Chowk',
    ]],
    ['name' => 'Goa', 'code' => 'GA', 'cities' => [
        'Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Bicholim', 'Curchorem', 'Sanquelim',
        'Valpoi', 'Canacona', 'Calangute', 'Quepem',
    ]],
    ['name' => 'Gujarat', 'code' => 'GJ', 'cities' => [
        'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Junagadh',
        'Gandhidham', 'Anand', 'Navsari', 'Morbi', 'Nadiad', 'Surendranagar', 'Bharuch', 'Mehsana', 'Bhuj',
        'Porbandar', 'Palanpur', 'Valsad', 'Vapi', 'Godhra', 'Veraval', 'Patan', 'Botad', 'Amreli',
        'Dahod', 'Himmatnagar', 'Ankleshwar', 'Gondal', 'Jetpur', 'Kalol', 'Deesa', 'Modasa', 'Dwarka',
    ]],
    ['name' => 'Haryana', 'code' => 'HR', 'cities' => [
        'Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat',
        'Panchkula', 'Bhiwani', 'Sirsa', 'Bahadurgarh', 'Jind', 'Thanesar', 'Kaithal', 'Rewari', 'Palwal',
        'Kurukshetra', 'Fatehabad', 'Narnaul', 'Jhajjar', 'Nuh', 'Charkhi Dadri', 'Hansi',
    ]],
    ['name' => 'Himachal Pradesh', 'code' => 'HP', 'cities' => [
        'Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Kullu', 'Manali', 'Palampur', 'Baddi', 'Nahan', 'Una',
        'Hamirpur', 'Bilaspur', 'Chamba', 'Kangra', 'Sundernagar', 'Keylong', 'Reckong Peo', 'Dalhousie',
    ]],
    ['name' => 'Jammu and Kashmir', 'code' => 'JK', 'cities' => [
        'Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Sopore', 'Kathua', 'Udhampur', 'Punch', 'Rajouri',
        'Kupwara', 'Pulwama', 'Budgam', 'Ganderbal', 'Bandipora', 'Shopian', 'Kulgam', 'Doda', 'Kishtwar',
        'Ramban', 'Reasi', 'Samba', 'Katra',
    ]],
    ['name' => 'Jharkhand', 'code' => 'JH', 'cities' => [
        'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro Steel City', 'Deoghar', 'Hazaribagh', 'Giridih', 'Ramgarh',
        'Phusro', 'Medininagar', 'Chaibasa', 'Dumka', 'Gumla', 'Chatra', 'Koderma', 'Lohardaga', 'Pakur',
        'Sahibganj', 'Godda', 'Simdega', 'Khunti', 'Latehar', 'Garhwa', 'Jamtara', 'Seraikela',
    ]],
    ['name' => 'Karnataka', 'code' => 'KA', 'cities' => [
        'Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Dharwad', 'Belagavi', 'Kalaburagi', 'Davanagere',
        'Ballari', 'Vijayapura', 'Shivamogga', 'Tumakuru', 'Raichur', 'Bidar', 'Hosapete', 'Udupi', 'Hassan',
        'Mandya', 'Chikkamagaluru', 'Chitradurga', 'Kolar', 'Gadag', 'Bagalkot', 'Karwar', 'Madikeri',
        'Chamarajanagar', 'Haveri', 'Koppal', 'Yadgir', 'Ramanagara', 'Chikkaballapur', 'Gangavati',
        'Robertsonpet', 'Bhadravati', 'Manipal', 'Kundapura', 'Puttur',
    ]],
    ['name' => 'Kerala', 'code' => 'KL', 'cities' => [
        'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Alappuzha', 'Palakkad',
        'Malappuram', 'Kottayam', 'Kasaragod', 'Pathanamthitta', 'Idukki', 'Painavu', 'Kalpetta', 'Ernakulam',
        'Thalassery', 'Manjeri', 'Ponnani', 'Vatakara', 'Kanhangad', 'Payyanur', 'Koyilandy', 'Tirur',
        'Perinthalmanna', 'Kottakkal', 'Nilambur', 'Ottapalam', 'Shoranur', 'Chalakudy', 'Kodungallur',
        'Guruvayur', 'Irinjalakuda', 'Kunnamkulam', 'Aluva', 'Perumbavoor', 'Muvattupuzha', 'Kothamangalam',
        'Angamaly', 'Thodupuzha', 'Pala', 'Changanassery', 'Cherthala', 'Kayamkulam', 'Thiruvalla',
        'Adoor', 'Karunagappally', 'Punalur', 'Attingal', 'Neyyattinkara', 'Nedumangad', 'Varkala',
        'Mananthavady', 'Sultan Bathery', 'Taliparamba', 'Iritty', 'Mattannur', 'Kattappana', 'Munnar',
        'Mannarkkad', 'Chittur', 'Alathur', 'Feroke', 'Ramanattukara', 'Mukkam', 'Thamarassery', 'Valanchery',
        'Tanur', 'Parappanangadi', 'Kondotty', 'Edappal', 'Wadakkanchery',
    ]],
    ['name' => 'Ladakh', 'code' => 'LA', 'cities' => [
        'Leh', 'Kargil', 'Diskit', 'Nyoma', 'Zanskar',
    ]],
    ['name' => 'Lakshadweep', 'code' => 'LD', 'cities' => [
        'Kavaratti', 'Agatti', 'Amini', 'Andrott', 'Minicoy',
    ]],
    ['name' => 'Madhya Pradesh', 'code' => 'MP', 'cities' => [
        'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa',
        'Murwara', 'Singrauli', 'Burhanpur', 'Khandwa', 'Bhind', 'Chhindwara', 'Guna', 'Shivpuri', 'Vidisha',
        'Chhatarpur', 'Damoh', 'Mandsaur', 'Khargone', 'Neemuch', 'Pithampur', 'Hoshangabad', 'Itarsi',
        'Sehore', 'Betul', 'Seoni', 'Datia', 'Nagda', 'Shahdol', 'Balaghat', 'Morena', 'Tikamgarh',
        'Mandla', 'Dhar', 'Jhabua', 'Barwani', 'Rajgarh', 'Shajapur', 'Panna', 'Sidhi',
    ]],
    ['name' => 'Maharashtra', 'code' => 'MH', 'cities' => [
        'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Chhatrapati Sambhajinagar', 'Solapur', 'Navi Mumbai',
        'Kalyan', 'Vasai-Virar', 'Pimpri-Chinchwad', 'Amravati', 'Kolhapur', 'Sangli', 'Malegaon', 'Jalgaon',
        'Akola', 'Latur', 'Dhule', 'Ahmednagar', 'Chandrapur', 'Parbhani', 'Ichalkaranji', 'Jalna',
        'Bhusawal', 'Panvel', 'Satara', 'Beed', 'Yavatmal', 'Gondia', 'Barshi', 'Osmanabad', 'Nanded',
        'Wardha', 'Ratnagiri', 'Bhiwandi', 'Mira-Bhayandar', 'Ulhasnagar', 'Ambernath', 'Badlapur', 'Lonavala',
        'Baramati', 'Alibag', 'Sindhudurg', 'Gadchiroli', 'Bhandara', 'Washim', 'Hingoli', 'Buldhana',
        'Nandurbar', 'Palghar', 'Shirdi',
    ]],
    ['name' => 'Manipur', 'code' => 'MN', 'cities' => [
        'Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Kakching', 'Ukhrul', 'Senapati', 'Tamenglong',
        'Chandel', 'Jiribam', 'Moreh',
    ]],
    ['name' => 'Meghalaya', 'code' => 'ML', 'cities' => [
        'Shillong', 'Tura', 'Jowai', 'Nongstoin', 'Williamnagar', 'Baghmara', 'Nongpoh', 'Resubelpara',
        'Mairang', 'Cherrapunji',
    ]],
    ['name' => 'Mizoram', 'code' => 'MZ', 'cities' => [
        'Aizawl', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib', 'Saiha', 'Lawngtlai', 'Mamit',
    ]],
    ['name' => 'Nagaland', 'code' => 'NL', 'cities' => [
        'Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto', 'Mon', 'Phek', 'Kiphire',
        'Longleng', 'Peren',
    ]],
    ['name' => 'Odisha', 'code' => 'OD', 'cities' => [
        'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore', 'Bhadrak',
        'Baripada', 'Jharsuguda', 'Jeypore', 'Bargarh', 'Rayagada', 'Bhawanipatna', 'Dhenkanal', 'Kendrapara',
        'Jajpur', 'Angul', 'Koraput', 'Paradip', 'Keonjhar', 'Sundargarh', 'Balangir', 'Phulbani',
        'Jagatsinghpur', 'Nabarangpur', 'Malkangiri', 'Nuapada', 'Sonepur', 'Boudh', 'Deogarh', 'Nayagarh',
        'Paralakhemundi', 'Talcher',
    ]],
    ['name' => 'Puducherry', 'code' => 'PY', 'cities' => [
        'Puducherry', 'Karaikal', 'Mahe', 'Yanam',
    ]],
    ['name' => 'Punjab', 'code' => 'PB', 'cities' => [
        'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Hoshiarpur', 'Batala',
        'Pathankot', 'Moga', 'Abohar', 'Malerkotla', 'Khanna', 'Phagwara', 'Muktsar', 'Barnala', 'Rajpura',
        'Firozpur', 'Kapurthala', 'Sangrur', 'Fazilka', 'Gurdaspur', 'Faridkot', 'Mansa', 'Nawanshahr',
        'Rupnagar', 'Tarn Taran', 'Fatehgarh Sahib', 'Zirakpur',
    ]],
    ['name' => 'Rajasthan', 'code' => 'RJ', 'cities' => [
        'Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara', 'Alwar', 'Bharatpur',
        'Sikar', 'Pali', 'Sri Ganganagar', 'Tonk', 'Kishangarh', 'Beawar', 'Hanumangarh', 'Dhaulpur',
        'Gangapur City', 'Sawai Madhopur', 'Churu', 'Jhunjhunu', 'Barmer', 'Jaisalmer', 'Nagaur',
        'Chittorgarh', 'Banswara', 'Bundi', 'Dungarpur', 'Jhalawar', 'Karauli', 'Pratapgarh', 'Rajsamand',
        'Sirohi', 'Mount Abu', 'Jalore', 'Baran', 'Dausa', 'Pushkar',
    ]],
    ['name' => 'Sikkim', 'code' => 'SK', 'cities' => [
        'Gangtok', 'Namchi', 'Gyalshing', 'Mangan', 'Rangpo', 'Singtam', 'Jorethang', 'Pakyong', 'Soreng',
    ]],
    ['name' => 'Tamil Nadu', 'code' => 'TN', 'cities' => [
        'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur', 'Vellore',
        'Erode', 'Thoothukudi', 'Dindigul', 'Thanjavur', 'Ranipet', 'Sivakasi', 'Karur', 'Udhagamandalam',
        'Hosur', 'Nagercoil', 'Kanchipuram', 'Kumbakonam', 'Rajapalayam', 'Pudukkottai', 'Ambur',
        'Tiruvannamalai', 'Pollachi', 'Karaikudi', 'Neyveli', 'Nagapattinam', 'Viluppuram', 'Cuddalore',
        'Namakkal', 'Krishnagiri', 'Dharmapuri', 'Ariyalur', 'Perambalur', 'Ramanathapuram', 'Sivaganga',
        'Virudhunagar', 'Theni', 'Tiruvallur', 'Chengalpattu', 'Kallakurichi', 'Tenkasi', 'Tirupathur',
        'Mayiladuthurai', 'Tiruvarur', 'Gudiyatham', 'Kodaikanal', 'Rameswaram', 'Mettupalayam',
    ]],
    ['name' => 'Telangana', 'code' => 'TS', 'cities' => [
        'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam', 'Mahbubnagar',
        'Nalgonda', 'Adilabad', 'Suryapet', 'Miryalaguda', 'Siddipet', 'Secunderabad', 'Mancherial',
        'Jagtial', 'Kamareddy', 'Kothagudem', 'Sangareddy', 'Medak', 'Vikarabad', 'Wanaparthy', 'Nirmal',
        'Bhongir', 'Jangaon', 'Peddapalli', 'Sircilla', 'Bodhan', 'Gadwal', 'Nagarkurnool', 'Narayanpet',
    ]],
    ['name' => 'Tripura', 'code' => 'TR', 'cities' => [
        'Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar', 'Belonia', 'Ambassa', 'Khowai', 'Teliamura',
        'Sabroom', 'Sonamura', 'Bishalgarh',
    ]],
    ['name' => 'Uttar Pradesh', 'code' => 'UP', 'cities' => [
        'Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Bareilly', 'Aligarh',
        'Moradabad', 'Saharanpur', 'Gorakhpur', 'Noida', 'Greater Noida', 'Firozabad', 'Jhansi',
        'Muzaffarnagar', 'Mathura', 'Ayodhya', 'Rampur', 'Shahjahanpur', 'Farrukhabad', 'Mau', 'Hapur',
        'Etawah', 'Mirzapur', 'Bulandshahr', 'Sambhal', 'Amroha', 'Hardoi', 'Fatehpur', 'Raebareli',
        'Orai', 'Sitapur', 'Bahraich', 'Modinagar', 'Unnao', 'Jaunpur', 'Lakhimpur', 'Hathras', 'Banda',
        'Pilibhit', 'Barabanki', 'Mainpuri', 'Gonda', 'Ballia', 'Azamgarh', 'Basti', 'Deoria', 'Etah',
        'Ghazipur', 'Sultanpur', 'Budaun', 'Bijnor', 'Lalitpur', 'Kannauj', 'Pratapgarh', 'Shamli',
        'Baghpat', 'Chitrakoot', 'Kushinagar', 'Maharajganj', 'Siddharthnagar', 'Sonbhadra', 'Vrindavan',
    ]],
    ['name' => 'Uttarakhand', 'code' => 'UK', 'cities' => [
        'Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur', 'Rishikesh', 'Nainital',
        'Mussoorie', 'Almora', 'Pithoragarh', 'Kotdwar', 'Ramnagar', 'Srinagar', 'Pauri', 'Tehri', 'Chamoli',
        'Uttarkashi', 'Bageshwar', 'Champawat', 'Rudraprayag',
    ]],
    ['name' => 'West Bengal', 'code' => 'WB', 'cities' => [
        'Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda', 'Baharampur',
        'Habra', 'Kharagpur', 'Shantipur', 'Haldia', 'Krishnanagar', 'Jalpaiguri', 'Cooch Behar', 'Bankura',
        'Purulia', 'Midnapore', 'Darjeeling', 'Alipurduar', 'Balurghat', 'Raiganj', 'Tamluk', 'Barasat',
        'Barrackpore', 'Serampore', 'Chandannagar', 'Hooghly', 'Kalyani', 'Bolpur', 'Suri', 'Diamond Harbour',
        'Kalimpong', 'Jhargram', 'Contai', 'Digha', 'Bishnupur',
    ]],
];
