
        // --- FIREBASE CONFIGURATION ---
        const firebaseConfig = {
            apiKey: "AIzaSyBAimpQP9bmvM88oOc3-P5ezbv94n7e1gE",
            authDomain: "manajemen-sekolah-7225b.firebaseapp.com",
            databaseURL: "https://manajemen-sekolah-7225b-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "manajemen-sekolah-7225b",
            storageBucket: "manajemen-sekolah-7225b.appspot.com",
            messagingSenderId: "10101010101",
            appId: "1:10101010101:web:10101010101"
        };

        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        const db = firebase.database();

        // STATE VARIABLES
        let currentUserData = null;
        let globalSettings = {};
        let globalPiket = {};
        let currentXtraList = [];
        let uploadedBuktiBase64 = null;
        let cachedIzinRequests = [];

        // --- INITIALIZATION ---
        db.ref('pengaturan/logoUrl').on('value', snap => {
            const url = snap.val();
            const logoContainer = document.getElementById('headerLogo');
            if (url) {
                logoContainer.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:contain;" alt="Logo">`;
            } else {
                logoContainer.innerHTML = `<i class="material-icons-round">school</i>`;
            }
        });

        // --- UI UTILS ---
        function checkInput() {
            const inputEl = document.getElementById('inputKode');
            const cleanVal = inputEl.value.trim();
            if (inputEl.value !== cleanVal) inputEl.value = cleanVal;
            document.getElementById('btnLogin').disabled = cleanVal.length === 0;
        }

        function showToast(message) {
            const toast = document.getElementById('toast');
            const msg = document.getElementById('toastMessage');
            msg.innerText = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // --- AUTH LOGIC ---
        function cekKode(destination) {
            const inputEl = document.getElementById('inputKode');
            const kode = inputEl.value.trim();

            if (!kode) return showToast("Masukkan kode pegawai!");

            const btn = document.getElementById('btnLogin');
            const originalText = btn.innerHTML;
            btn.innerHTML = `<i class="material-icons-round" style="animation:spin 1s linear infinite">refresh</i> Memuat...`;
            btn.disabled = true;

            db.ref('database/' + kode).once('value', (snap) => {
                const data = snap.val();

                btn.innerHTML = originalText;
                btn.disabled = false;

                if (!data || !data.nama) {
                    showToast("Kode pegawai tidak ditemukan.");
                    return;
                }

                currentUserData = data;
                updateProfileUI(data);

                document.getElementById('loginSection').classList.add('hidden');
                document.getElementById('dashboardWrapper').classList.remove('hidden');
                document.getElementById('navMenu').classList.remove('hidden');
                document.getElementById('logoutBtn').classList.remove('hidden');

                loadInitialData(data.nama);
                setupRealtimeListeners(data.nama);

                const date = new Date();
                const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
                document.getElementById('monthLabel').innerText = months[date.getMonth()] + " " + date.getFullYear();

                if (destination === 'izin') switchTab('izin');
                else switchTab('history');
            });
        }

        function updateProfileUI(data) {
            document.getElementById('displayNama').innerText = data.nama;
            document.getElementById('displayJabatan').innerText = data.jabatan || "Staf";
        }

        function switchTab(tab) {
            const navHistory = document.getElementById('navHistory');
            const navIzin = document.getElementById('navIzin');
            const navGaji = document.getElementById('navGaji');
            const historyContent = document.getElementById('historyContent');
            const izinContent = document.getElementById('izinContent');
            const gajiContent = document.getElementById('gajiContent');

            // Reset all
            navHistory.classList.remove('active');
            navIzin.classList.remove('active');
            if(navGaji) navGaji.classList.remove('active');
            historyContent.classList.remove('active');
            izinContent.classList.remove('active');
            if(gajiContent) gajiContent.classList.remove('active');

            if (tab === 'history') {
                navHistory.classList.add('active');
                historyContent.classList.add('active');
            } else if (tab === 'gaji') {
                if(navGaji) navGaji.classList.add('active');
                if(gajiContent) gajiContent.classList.add('active');
            } else {
                navIzin.classList.add('active');
                izinContent.classList.add('active');
            }
        }

        function logout() {
            document.getElementById('inputKode').value = "";
            document.getElementById('loginSection').classList.remove('hidden');
            document.getElementById('dashboardWrapper').classList.add('hidden');
            document.getElementById('navMenu').classList.add('hidden');
            document.getElementById('logoutBtn').classList.add('hidden');
            checkInput();
            currentUserData = null;
            cachedIzinRequests = [];
        }

        // --- IZIN LOGIC ---
        function toggleDinasOptions() {
            const jenis = document.getElementById('izinJenis').value;
            const div = document.getElementById('dinasOptions');
            if (jenis === 'Tugas Luar') div.classList.remove('hidden');
            else {
                div.classList.add('hidden');
                document.getElementById('skipDatang').checked = false;
                document.getElementById('skipPulang').checked = false;
            }
        }

        function showUploadMenu() {
            if (confirm("Ambil foto dari Kamera sekarang?")) {
                document.getElementById('cameraInput').click();
            } else {
                document.getElementById('galleryInput').click();
            }
        }

        function handleFileSelect(input) {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = new Image();
                    img.src = e.target.result;
                    img.onload = function () {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const MAX_WIDTH = 800;
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        uploadedBuktiBase64 = canvas.toDataURL('image/jpeg', 0.7);

                        document.getElementById('previewImage').src = uploadedBuktiBase64;
                        document.getElementById('uploadPlaceholder').classList.add('hidden');
                        document.getElementById('previewContainer').classList.remove('hidden');
                    };
                };
                reader.readAsDataURL(file);
            }
        }

        function removeUpload() {
            uploadedBuktiBase64 = null;
            document.getElementById('cameraInput').value = "";
            document.getElementById('galleryInput').value = "";
            document.getElementById('previewContainer').classList.add('hidden');
            document.getElementById('uploadPlaceholder').classList.remove('hidden');
        }

        function kirimIzin() {
            const tgl = document.getElementById('izinTanggal').value;
            const jenis = document.getElementById('izinJenis').value;
            const alasan = document.getElementById('izinAlasan').value.trim();

            if (!tgl) return showToast("Pilih tanggal izin!");
            if (!jenis) return showToast("Pilih jenis izin!");
            if (!alasan) return showToast("Isi alasan izin!");

            let absensiDilewati = [];
            if (jenis === 'Tugas Luar') {
                if (document.getElementById('skipDatang').checked) absensiDilewati.push('datang');
                if (document.getElementById('skipPulang').checked) absensiDilewati.push('pulang');
            }

            const payload = {
                nama: currentUserData.nama,
                tanggal: tgl,
                jenis: jenis,
                alasan: alasan,
                bukti: uploadedBuktiBase64 || null,
                status: 'pending',
                absensi_dilewati: absensiDilewati,
                timestamp: Date.now()
            };

            const btn = document.getElementById('btnSubmitIzin');
            btn.disabled = true;
            btn.innerHTML = `<i class="material-icons-round" style="animation:spin 1s linear infinite">refresh</i> Mengirim...`;

            db.ref('requests_izin').push(payload).then(() => {
                showToast("Pengajuan berhasil dikirim!");
                // Reset Form
                document.getElementById('izinAlasan').value = "";
                document.getElementById('izinTanggal').value = "";
                document.getElementById('izinJenis').selectedIndex = 0;
                removeUpload();
                toggleDinasOptions();
                btn.disabled = false;
                btn.innerHTML = `<i class="material-icons-round">send</i> Kirim Pengajuan`;
            }).catch(e => {
                showToast("Gagal mengirim: " + e.message);
                btn.disabled = false;
                btn.innerHTML = `<i class="material-icons-round">send</i> Kirim Pengajuan`;
            });
        }

        // --- DATA HANDLING & REALTIME LISTENERS ---

        function loadInitialData(nama) {
            // Fetch initial data once
            Promise.all([
                db.ref('pengaturan').once('value'),
                db.ref('requests_izin').orderByChild('nama').equalTo(nama).limitToLast(50).once('value')
            ]).then(([snapSet, snapIzin]) => {
                const settingsData = snapSet.val() || {};
                globalSettings = settingsData.rules || {};
                globalPiket = (settingsData.masterData && settingsData.masterData.piket) ? settingsData.masterData.piket : {};
                currentXtraList = settingsData.xtraList || [];

                const masterTunjangan = settingsData.masterTunjangan || { tunjangan: [], potongan: [] };
                window.masterTunjanganData = masterTunjangan; // save for slip rendering later

                const izinData = snapIzin.val();
                cachedIzinRequests = [];
                if (izinData) {
                    Object.values(izinData).forEach(req => {
                        if (req.tanggal && req.tanggal !== "" && String(new Date(req.tanggal)) !== "Invalid Date") {
                            cachedIzinRequests.push(req);
                        }
                    });
                }
                // Render Izin Table Initial
                renderIzinTable(cachedIzinRequests);
            });
        }

        function setupRealtimeListeners(nama) {
            // 1. Listener Izin
            db.ref('requests_izin').orderByChild('nama').equalTo(nama).limitToLast(50).on('value', (snap) => {
                const data = snap.val();
                cachedIzinRequests = [];
                if (data) {
                    Object.values(data).forEach(req => {
                        if (req.tanggal && req.tanggal !== "") cachedIzinRequests.push(req);
                    });
                }
                renderIzinTable(cachedIzinRequests);
                // Trigger re-render of main history too (since izin affects presence display)
                refreshMainHistory();
            });

            // 2. Listener Logs (Realtime Update)
            // We use .on() so whenever database changes, this function runs automatically
            db.ref('logs_presensi_sekolah').on('value', () => { refreshMainHistory(); });
            db.ref('logs_pengajian').on('value', () => { refreshMainHistory(); });
            db.ref('logs_ekstrakurikuler').on('value', () => { refreshMainHistory(); });

            // 3. Listener Settings
            db.ref('pengaturan').on('value', (snap) => {
                const settingsData = snap.val() || {};
                globalSettings = settingsData.rules || {};
                globalPiket = (settingsData.masterData && settingsData.masterData.piket) ? settingsData.masterData.piket : {};
                currentXtraList = settingsData.xtraList || [];
                refreshMainHistory();
            });

            // 4. Listener Gaji Diterbitkan (Published Payroll)
            let date = new Date();
            if (date.getDate() > 25) date.setMonth(date.getMonth() + 1);
            const periodStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            db.ref('payroll_published/' + periodStr).on('value', (snap) => {
                const payrollLengkap = snap.val() || {};
                const myKode = document.getElementById('inputKode').value.trim();
                const myPayroll = payrollLengkap[myKode];
                
                const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
                document.getElementById('gajiMonthLabel').innerText = `(Periode ${monthNames[date.getMonth()]} ${date.getFullYear()})`;
                
                if (myPayroll) {
                    window.currentMyPayroll = myPayroll;
                    document.getElementById('gajiBelumTersedia').classList.add('hidden');
                    document.getElementById('gajiTersedia').classList.remove('hidden');
                    document.getElementById('gajiBersihDisplay').innerText = `Rp ${myPayroll.bersih.toLocaleString()}`;
                    
                    // Juga perbarui badge di header
                    document.getElementById('totalInsentifDisplay').innerText = `Rp ${myPayroll.totalInsentif.toLocaleString()}`;
                } else {
                    window.currentMyPayroll = null;
                    document.getElementById('gajiBelumTersedia').classList.remove('hidden');
                    document.getElementById('gajiTersedia').classList.add('hidden');
                    
                    // Karena gaji belum terbit, insentif di header pakai Rp 0 atau total realtime
                    // Lebih elegan pakai realtime dari renderHistoryTable
                }
            });
        }

        function refreshMainHistory() {
            // Debounce to avoid rapid flickering
            if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
            this.refreshTimeout = setTimeout(() => {
                Promise.all([
                    db.ref('logs_presensi_sekolah').limitToLast(500).once('value'),
                    db.ref('logs_pengajian').limitToLast(500).once('value'),
                    db.ref('logs_ekstrakurikuler').limitToLast(500).once('value')
                ]).then(([snapSekolah, snapPengajian, snapXtra]) => {
                    renderHistoryTable(snapSekolah.val() || {}, snapPengajian.val() || {}, snapXtra.val() || {});
                });
            }, 300);
        }

        // --- CORE LOGIC CALCULATIONS ---

        function normalizeTime(timeStr) {
            if (!timeStr) return null;
            let cleanTime = String(timeStr).replace(/\./g, ':');
            if (cleanTime.length >= 5) return cleanTime.substring(0, 5);
            return null;
        }

        function getDiffMinutes(jamMasuk, batasWaktu) {
            const cleanMasuk = normalizeTime(jamMasuk);
            const cleanBatas = normalizeTime(batasWaktu);
            if (!cleanMasuk || !cleanBatas) return 0;
            const [h1, m1] = cleanMasuk.split(':').map(Number);
            const [h2, m2] = cleanBatas.split(':').map(Number);
            if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
            const dateMasuk = new Date(2000, 0, 1, h1, m1);
            const dateBatas = new Date(2000, 0, 1, h2, m2);
            const diffMs = dateMasuk - dateBatas;
            return Math.floor(diffMs / 60000);
        }

        function calculateInsentif(log, izinRequest) {
            let result = { datang: 0, pulang: 0, total: 0 };

            // Jika ada izin yang bukan Tugas Luar (dan valid/pending), insentif sekolah 0
            if (izinRequest && izinRequest.status !== 'rejected' && izinRequest.jenis !== 'Tugas Luar') {
                return result;
            }

            if (log.type === 'Pengajian') {
                const nominal = parseInt(globalSettings['Insentif Pengajian']?.nominal || 0);
                result.total = nominal;
                return result;
            }

            if (log.type === 'Ekstrakurikuler') {
                const xItem = currentXtraList.find(x => x.nama === log.keterangan);
                const nominal = parseInt(xItem?.insentif || 0);
                result.total = nominal;
                return result;
            }

            if (log.type === 'Sekolah') {
                const jabatan = (currentUserData.jabatan || "").toLowerCase();
                const isKepsek = jabatan.includes("kepala sekolah");
                const isPiket = log.isPiket || false;

                // --- HITUNG MASUK ---
                const isAccDatang = log.accDatang === true;
                if (isAccDatang) {
                    let nominalTertib = parseInt(globalSettings['Insentif Tertib']?.nominal || 0);
                    let nominalPiket = parseInt(globalSettings['Insentif Piket Tepat']?.nominal || 0);
                    result.datang = (isKepsek || isPiket) ? (nominalTertib + nominalPiket) : nominalTertib;
                } else {
                    if (log.jamDatang) {
                        let batasDatang = globalSettings["Batas Reguler"]?.jam || "07:00";
                        if (isKepsek && globalSettings["Batas Kepala Sekolah"]?.jam) batasDatang = globalSettings["Batas Kepala Sekolah"].jam;
                        else if (isPiket && globalSettings["Batas Piket"]?.jam) batasDatang = globalSettings["Batas Piket"].jam;

                        const nominalTertib = parseInt(globalSettings['Insentif Tertib']?.nominal || 0);
                        const nominalPiket = parseInt(globalSettings['Insentif Piket Tepat']?.nominal || 0);
                        const diff = getDiffMinutes(log.jamDatang, batasDatang);
                        if (diff <= 0) {
                            result.datang = (isKepsek || isPiket) ? (nominalTertib + nominalPiket) : nominalTertib;
                        }
                    }
                }

                // --- HITUNG PULANG ---
                const isAccPulang = log.accPulang === true;
                if (isAccPulang) {
                    const nominalPulang = parseInt(globalSettings['Insentif Pulang']?.nominal || 0);
                    result.pulang = nominalPulang;
                } else {
                    if (log.jamPulang) {
                        const nominalPulang = parseInt(globalSettings['Insentif Pulang']?.nominal || 0);
                        let batasPulangStr = globalSettings["Batas Pulang"]?.jam || "14:00";
                        let jamPulangMin = (h, m) => (h * 60) + m;
                        let [h1, m1] = normalizeTime(log.jamPulang).split(':').map(Number);
                        let [h2, m2] = normalizeTime(batasPulangStr).split(':').map(Number);

                        // Logika insentif pulang: dapat jika >= batas pulang ATAU jika admin acc manual
                        if (jamPulangMin(h1, m1) >= jamPulangMin(h2, m2)) result.pulang = nominalPulang;
                        // Jika pulang cepat, default logic biasanya tidak dapat insentif kecuali ada aturan khusus
                    }
                }
            }
            result.total = result.datang + result.pulang;
            return result;
        }

        // --- RENDERING ---

        function renderIzinTable(requests) {
            const tbody = document.getElementById('izinHistoryBody');
            tbody.innerHTML = "";

            // Sort descending
            requests.sort((a, b) => b.timestamp - a.timestamp);

            if (requests.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Belum ada riwayat izin.</td></tr>';
                return;
            }

            requests.forEach(req => {
                // Style Status
                let statusColor = "var(--text-muted)";
                let statusLabel = "Menunggu"; // Default
                let dotColor = "#f59e0b"; // Warning yellow

                if (req.status === 'approved') {
                    statusColor = "var(--primary)";
                    statusLabel = "Disetujui"; // Request: Full text
                    dotColor = "#059669"; // Green
                }
                else if (req.status === 'rejected') {
                    statusColor = "var(--danger)";
                    statusLabel = "Ditolak"; // Request: Full text
                    dotColor = "#ef4444"; // Red
                }

                // Format Tanggal
                const parts = req.tanggal.split('-');
                const dateStr = `${parts[2]}/${parts[1]}`;

                // Build Admin Info HTML (Wrap to next line if long)
                let adminInfoHtml = '';
                if (req.adminName || req.adminNote) {
                    adminInfoHtml = `<div class="admin-info">
                   ${req.adminName ? `<strong>Oleh:</strong> ${req.adminName}` : ''}
                   ${req.adminNote ? `<br><span style="font-style:italic;">"${req.adminNote}"</span>` : ''}
               </div>`;
                }

                // Row Construction
                // Column 1: Date
                // Column 2: Type Badge
                // Column 3: Status (Text) + Admin Info (Below)
                const row = `<tr>
                <td style="vertical-align:top; padding-top:16px; font-weight:600;">${dateStr}</td>
                <td style="vertical-align:top; padding-top:16px;">
                    <span class="badge bg-purple" style="font-size:9px; padding:4px 8px;">${req.jenis}</span>
                </td>
                <td style="vertical-align:top; padding-top:14px;">
                    <div class="status-text" style="color:${statusColor}; margin-bottom: 4px;">
                        <span class="dot" style="background:${dotColor}"></span> ${statusLabel}
                    </div>
                    ${adminInfoHtml}
                    ${req.alasan ? `<div style="font-size:11px; color:#64748b; margin-top:2px;">Alasan: ${req.alasan}</div>` : ''}
                </td>
           </tr>`;
                tbody.innerHTML += row;
            });
        }

        function renderHistoryTable(dataSekolah, dataPengajian, dataXtra) {
            const tbody = document.getElementById('historyBody');
            tbody.innerHTML = "";
            let logs = [];
            let processedDates = new Set();

            // Stats
            let countHadir = 0, countTelat = 0, countIzin = 0;

            // Process Sekolah Logs
            if (dataSekolah) {
                Object.keys(dataSekolah).forEach(date => {
                    const logsPerDate = dataSekolah[date];
                    if (logsPerDate) {
                        Object.values(logsPerDate).forEach(log => {
                            if (log.nama === currentUserData.nama) {
                                const dateObj = log.tanggal ? new Date(log.tanggal) : null;
                                if (dateObj && !isNaN(dateObj.getTime())) {
                                    const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dateObj.getDay()];
                                    const piketList = Array.isArray(globalPiket[dayName]) ? globalPiket[dayName] : [];
                                    const isPiket = piketList.includes(currentUserData.nama);
                                    logs.push({ ...log, type: 'Sekolah', isPiket: isPiket, dayName: dayName, isFromIzin: false });
                                    processedDates.add(log.tanggal);
                                    countHadir++;
                                }
                            }
                        });
                    }
                });
            }

            // Process Pengajian
            if (dataPengajian) {
                Object.keys(dataPengajian).forEach(date => {
                    const logsPerDate = dataPengajian[date];
                    if (logsPerDate) {
                        Object.values(logsPerDate).forEach(log => {
                            if (log.nama === currentUserData.nama) {
                                const dateObj = log.tanggal ? new Date(log.tanggal) : null;
                                if (dateObj && !isNaN(dateObj.getTime())) {
                                    logs.push({ ...log, type: 'Pengajian' });
                                    processedDates.add(log.tanggal);
                                    countHadir++;
                                }
                            }
                        });
                    }
                });
            }

            // Process Xtra
            if (dataXtra) {
                Object.keys(dataXtra).forEach(date => {
                    const logsPerDate = dataXtra[date];
                    if (logsPerDate) {
                        Object.values(logsPerDate).forEach(log => {
                            if (log.nama === currentUserData.nama) {
                                const dateObj = log.tanggal ? new Date(log.tanggal) : null;
                                if (dateObj && !isNaN(dateObj.getTime())) {
                                    logs.push({ ...log, type: 'Ekstrakurikuler' });
                                    processedDates.add(log.tanggal);
                                    countHadir++;
                                }
                            }
                        });
                    }
                });
            }

            // Process Izin (Inject dummy log for history consistency if needed)
            cachedIzinRequests.forEach(req => {
                const reqDateObj = req.tanggal ? new Date(req.tanggal) : null;
                if (req.tanggal && reqDateObj && !isNaN(reqDateObj.getTime()) && !processedDates.has(req.tanggal)) {
                    let dummyLog = {
                        tanggal: req.tanggal,
                        jamDatang: null, jamPulang: null,
                        type: 'Sekolah', isFromIzin: true,
                        accDatang: false, accPulang: false, isPiket: false, dayName: '-'
                    };
                    if (req.jenis === 'Tugas Luar' && (req.status === 'approved' || req.status === 'pending')) {
                        const skips = req.absensi_dilewati || [];
                        if (skips.includes('datang')) dummyLog.accDatang = true;
                        if (skips.includes('pulang')) dummyLog.accPulang = true;
                    }
                    logs.push(dummyLog);
                    processedDates.add(req.tanggal);
                    countIzin++;
                }
            });

            // Update Stats UI
            document.getElementById('statHadir').innerText = countHadir;
            document.getElementById('statIzin').innerText = countIzin;

            if (logs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="material-icons-round">event_busy</i><p>Belum ada riwayat presensi.</p></td></tr>`;
                document.getElementById('totalInsentifDisplay').innerText = "Rp 0";
                return;
            }

            // Sort logs descending
            logs.sort((a, b) => (b.timestamp || (new Date(b.tanggal).getTime())) - (a.timestamp || (new Date(a.tanggal).getTime())));
            let grandTotal = 0;

            logs.forEach(log => {
                const badgeClass = log.type === 'Sekolah' ? 'bg-sekolah' : (log.type === 'Pengajian' ? 'bg-pengajian' : 'bg-xtra');
                const logDateKey = log.tanggal;

                const anyIzinRequest = cachedIzinRequests.find(iz => iz.tanggal === logDateKey);
                const insentifData = calculateInsentif(log, anyIzinRequest);
                grandTotal += insentifData.total;

                let displayJamDatang = "-", displayJamPulang = "-", statusText = "⏳ Belum Lengkap";
                let jamDatangStyle = "color:var(--text-main)", jamPulangStyle = "color:var(--text-main)";

                let dateObj = log.tanggal ? new Date(log.tanggal) : null;
                let formattedDate = dateObj ? `${dateObj.getDate()}/${dateObj.getMonth() + 1}` : "-";

                if (log.type === 'Sekolah') {

                    if (anyIzinRequest) {
                        if (anyIzinRequest.status === 'rejected') {
                            displayJamDatang = `<span style="color:var(--danger)">✖</span>`;
                            displayJamPulang = `<span style="color:var(--danger)">✖</span>`;
                            statusText = `<span style="color:var(--danger)">Ditolak</span>`;
                        } else if (anyIzinRequest.jenis === 'Tugas Luar') {
                            const statusTL = anyIzinRequest.status === 'pending' ? 'Menunggu' : 'Disetujui';
                            if (log.accDatang) { displayJamDatang = `<span style="color:var(--primary)">✔</span>`; } else { displayJamDatang = `<span style="color:var(--warning)">⏳</span>`; }
                            if (log.accPulang) { displayJamPulang = `<span style="color:var(--primary)">✔</span>`; } else { displayJamPulang = `<span style="color:var(--warning)">⏳</span>`; }
                            statusText = `<span style="color:var(--accent)">Tugas Luar (${statusTL})</span>`;
                        } else {
                            displayJamDatang = `<span style="color:var(--accent)">✔</span>`;
                            displayJamPulang = `<span style="color:var(--accent)">✔</span>`;
                            statusText = `<span style="color:var(--accent)">Izin (${anyIzinRequest.status === 'pending' ? 'Menunggu' : 'Disetujui'})</span>`;
                        }
                    } else {
                        // Normal Presensi Logic
                        const jabatan = (currentUserData.jabatan || "").toLowerCase();
                        const isKepsek = jabatan.includes("kepala sekolah");
                        const isPiket = log.isPiket || false;

                        let batasDatang = globalSettings["Batas Reguler"]?.jam || "07:00";
                        if (isKepsek && globalSettings["Batas Kepala Sekolah"]) batasDatang = globalSettings["Batas Kepala Sekolah"].jam;
                        else if (isPiket && globalSettings["Batas Piket"]) batasDatang = globalSettings["Batas Piket"].jam;

                        if (log.accDatang === true) {
                            displayJamDatang = `<i class="material-icons-round" style="font-size:14px; color:var(--primary)">check_circle</i> <span style="font-size:11px; color:var(--text-muted)">ACC</span>`;
                        } else if (log.jamDatang) {
                            displayJamDatang = normalizeTime(log.jamDatang);
                            const diff = getDiffMinutes(log.jamDatang, batasDatang);
                            if (diff > 0) {
                                jamDatangStyle = "color:var(--danger); font-weight:700;";
                                countTelat++;
                            }
                        }

                        if (log.accPulang === true) {
                            displayJamPulang = `<i class="material-icons-round" style="font-size:14px; color:var(--primary)">check_circle</i> <span style="font-size:11px; color:var(--text-muted)">ACC</span>`;
                        } else if (log.jamPulang) {
                            displayJamPulang = normalizeTime(log.jamPulang);
                            const batasPulang = globalSettings["Batas Pulang"]?.jam || "14:00";
                            const [h, m] = normalizeTime(log.jamPulang).split(':').map(Number);
                            const [bh, bm] = normalizeTime(batasPulang).split(':').map(Number);
                            if (((h * 60) + m) < ((bh * 60) + bm)) {
                                jamPulangStyle = "color:var(--warning); font-weight:600;";
                            }
                        }

                        if (log.jamDatang && log.jamPulang) statusText = "✅ Lengkap";
                        else if (log.accDatang && log.accPulang) statusText = "✅ Lengkap (ACC)";
                        else statusText = "⏳ Belum Lengkap";
                    }

                } else {
                    displayJamDatang = log.keterangan || "-";
                    statusText = "✅ Hadir";
                }

                const rowHtml = `
        <tr>
          <td style="font-weight:600; color:var(--text-muted); vertical-align:middle;">${formattedDate}</td>
          <td style="vertical-align:middle;"><span class="badge ${badgeClass}">${log.type}</span></td>
          <td style="${jamDatangStyle}; vertical-align:middle;">${displayJamDatang}</td>
          <td style="${jamPulangStyle}; vertical-align:middle;">${displayJamPulang}</td>
          <td style="font-size:12px; vertical-align:middle;">${statusText}</td>
          <td class="text-right font-mono" style="font-weight:600; color:var(--primary); vertical-align:middle;">
              ${insentifData.total > 0 ? 'Rp ' + insentifData.total.toLocaleString() : '-'}
          </td>
        </tr>`;
                tbody.innerHTML += rowHtml;
            });

            document.getElementById('statTelat').innerText = countTelat;
            // Jika gaji belum terbit, setidaknya update badge dari hitungan murni hari ini
            if (!window.currentMyPayroll) {
                document.getElementById('totalInsentifDisplay').innerText = "Rp " + grandTotal.toLocaleString();
            }
        }

        // ==========================================
        // [BARU] MODAL SLIP GAJI DIGITAL
        // ==========================================
        function bukaModalSlipGaji() {
            if (!window.currentMyPayroll) return showToast("Data gaji belum tersedia.");
            const row = window.currentMyPayroll;
            
            const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
            let date = new Date();
            // Asumsi current month calculation same as period logic
            if (date.getDate() > 25) date.setMonth(date.getMonth() + 1);
            const periodStr = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

            const logoUrl = document.getElementById('headerLogo').querySelector('img')?.src || '';
            const persenClass = row.persenHadir >= 90 ? 'persen-high' : row.persenHadir >= 70 ? 'persen-mid' : 'persen-low';
            
            const masterTunjangan = window.masterTunjanganData || { tunjangan: [], potongan: [] };

            let tunjanganRows = '';
            masterTunjangan.tunjangan.forEach(t => {
                const val = row.tunjanganCols[t.id] || 0;
                if (val > 0) {
                    tunjanganRows += `<tr><td style="padding:4px 0;">+ ${t.nama}</td><td style="padding:4px 0;"></td><td style="text-align:right; padding:4px 0;">Rp ${val.toLocaleString()}</td></tr>`;
                }
            });

            let potonganRows = '';
            masterTunjangan.potongan.forEach(p => {
                const val = row.potonganCols[p.id] || 0;
                if (val > 0) {
                    potonganRows += `<tr><td style="color:#dc2626; padding:4px 0;">- ${p.nama}</td><td style="padding:4px 0;"></td><td style="text-align:right; color:#dc2626; padding:4px 0;">Rp ${val.toLocaleString()}</td></tr>`;
                }
            });

            // Replicate styling from Admin Slip Modal for print compatibility
            const slipHtml = `
                <div style="display:flex; align-items:center; gap:16px; margin-bottom:24px; padding-bottom:16px; border-bottom:2px solid #e2e8f0;">
                    ${logoUrl ? `<img src="${logoUrl}" style="width:60px; height:60px; object-fit:contain;">` : `<div style="width:60px; height:60px; background:#f1f5f9; border-radius:8px; display:flex; align-items:center; justify-content:center;"><i class="material-icons-round" style="color:#94a3b8; font-size:32px;">school</i></div>`}
                    <div>
                        <h2 style="font-size:18px; font-weight:800; color:#0f172a; margin:0;">SD MUHAMMADIYAH SERUT</h2>
                        <div style="font-size:13px; color:#475569; margin-top:2px;">Slip Gaji Pegawai &middot; <strong>Periode ${periodStr}</strong></div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; background:#f8fafc; padding:16px; border-radius:12px; margin-bottom:24px; font-size:13px;">
                    <div><span style="color:#475569;">Nama Pegawai</span><br><strong style="font-size:14px;">${row.nama}</strong></div>
                    <div><span style="color:#475569;">Kode / ID</span><br><strong>${row.kode}</strong></div>
                    <div><span style="color:#475569;">Jabatan</span><br><strong>${row.jabatan}</strong></div>
                    <div><span style="color:#475569;">Kehadiran Aktif</span><br>
                        <strong>${row.persenHadir}%</strong>
                        <span class="persen-badge ${persenClass}" style="margin-left:6px; font-size:10px; padding:2px 6px; border-radius:4px; background:${row.persenHadir>=90?'#dcfce7':row.persenHadir>=70?'#fef3c7':'#fee2e2'}; color:${row.persenHadir>=90?'#166534':row.persenHadir>=70?'#92400e':'#991b1b'};">${row.persenHadir}%</span>
                    </div>
                </div>

                <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:24px;">
                    <tbody>
                        <tr style="background:#eff6ff;"><td style="font-weight:700; color:#1d4ed8; padding:8px 0;">Gaji Pokok</td><td></td><td style="text-align:right; font-weight:700; padding:8px 0;">Rp ${row.gajiPokok.toLocaleString()}</td></tr>
                        ${tunjanganRows || '<tr><td colspan="3" style="color:#94a3b8; font-size:12px; padding:8px 0;">Tidak ada tunjangan khusus</td></tr>'}
                        <tr style="border-top:1px dashed #cbd5e1; border-bottom:1px dashed #cbd5e1;"><td style="padding:8px 0; font-weight:600;">Subtotal Penerimaan</td><td></td><td style="text-align:right; font-weight:600; padding:8px 0;">Rp ${(row.gajiPokok + row.totalTunjangan + row.insentifReguler + row.insentifEkstra).toLocaleString()}</td></tr>
                        
                        <tr style="background:#ecfdf5;"><td style="font-weight:700; color:#059669; padding:8px 0;">Insentif Kehadiran (Reguler)</td><td style="font-size:11px; padding:8px 0;">${row.persenHadir >= 90 ? '✅ Kehadiran Baik' : '⚠️ Kehadiran Kurang'}</td><td style="text-align:right; font-weight:700; color:#059669; padding:8px 0;">Rp ${row.insentifReguler.toLocaleString()}</td></tr>
                        ${row.insentifEkstra > 0 ? `<tr style="background:#f0fdfa;"><td style="font-weight:700; color:#0d9488; padding:8px 0;">Insentif Ekstrakurikuler</td><td style="font-size:11px; padding:8px 0;">Sesuai log kehadiran</td><td style="text-align:right; font-weight:700; color:#0d9488; padding:8px 0;">Rp ${row.insentifEkstra.toLocaleString()}</td></tr>` : ''}
                        
                        ${potonganRows || ''}
                        ${row.totalPotongan > 0 ? `<tr style="border-top:1px dashed #cbd5e1; border-bottom:1px dashed #cbd5e1;"><td style="color:#dc2626; font-weight:600; padding:8px 0;">Subtotal Potongan</td><td></td><td style="text-align:right; color:#dc2626; font-weight:600; padding:8px 0;">- Rp ${row.totalPotongan.toLocaleString()}</td></tr>` : ''}
                    </tbody>
                </table>

                <div style="background:linear-gradient(135deg, #1e293b, #0f172a); color:white; padding:16px 20px; border-radius:12px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:13px; color:#cbd5e1; font-weight:500;">Total Gaji Bersih Diterima</div>
                    <div style="font-size:20px; font-weight:800; color:#4ade80;">Rp ${row.bersih.toLocaleString()}</div>
                </div>

                <div style="margin-top:30px; display:grid; grid-template-columns:1fr 1fr; gap:40px; font-size:12px; color:#475569; text-align:center;">
                    <div></div>
                    <div>
                        <div style="margin-bottom:60px;">HRD / Bendahara</div>
                        <div style="font-weight:600; border-bottom:1px solid #cbd5e1; display:inline-block; padding-bottom:4px; min-width:120px;">( .................... )</div>
                    </div>
                </div>
            `;

            document.getElementById('slipContent').innerHTML = slipHtml;
            document.getElementById('slipModal').style.display = 'flex';
        }

        function tutupModalSlipGaji() {
            document.getElementById('slipModal').style.display = 'none';
        }

        function cetakSlipGaji() {
            const content = document.getElementById('slipContent').innerHTML;
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Cetak Slip Gaji</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                        body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 40px; color: #1e293b; line-height:1.5; }
                        * { box-sizing: border-box; }
                        @media print {
                            body { padding: 0; }
                            @page { margin: 1cm; }
                        }
                    </style>
                </head>
                <body>
                    <div style="max-width: 800px; margin: 0 auto;">
                        ${content}
                    </div>
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    <\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }

        // Handle Enter Key
        document.getElementById("inputKode").addEventListener("keypress", function (event) {
            if (event.key === "Enter") cekKode('history');
        });

    