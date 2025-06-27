// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA6_OACwpwaFSiX8jfsjS0_bt_EfIc4rhY",
  authDomain: "physiocare-booking.firebaseapp.com",
  projectId: "physiocare-booking",
  storageBucket: "physiocare-booking.firebasestorage.app",
  messagingSenderId: "815959251074",
  appId: "1:815959251074:web:cfd13396b4072b90ccbc9b",
  measurementId: "G-HBYJGQRVBB"
};};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// --- عناصر الصفحة ---
const dateInput = document.getElementById('session-date');
const dateError = document.getElementById('date-error');
const morningShiftContainer = document.getElementById('morning-shift');
const eveningShiftContainer = document.getElementById('evening-shift');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');
const selectedTimeDisplay = document.getElementById('selected-time-display');
const bookingForm = document.getElementById('booking-form');
const submitBtn = document.getElementById('submit-booking-btn');
const btnText = document.querySelector('.btn-text');
const loader = document.getElementById('loader');
const fileInput = document.getElementById('file-upload');
const fileNameDisplay = document.getElementById('file-name-display');

// --- إعدادات المواعيد ---
const sessionDuration = 40; // دقائق
let selectedSlot = null;

// --- وظائف ---
function generateTimeSlots() {
    morningShiftContainer.innerHTML = '';
    eveningShiftContainer.innerHTML = '';
    const createSlot = (hour, minute, shiftContainer) => {
        const time = new Date();
        time.setHours(hour, minute, 0, 0);
        const timeString = time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const slot = document.createElement('div');
        slot.classList.add('time-slot', 'available');
        slot.dataset.time = timeString;
        slot.innerText = timeString;
        shiftContainer.appendChild(slot);
    };
    
    let morningTime = new Date();
    morningTime.setHours(10, 30, 0, 0);
    for (let i = 0; i < 5; i++) {
        createSlot(morningTime.getHours(), morningTime.getMinutes(), morningShiftContainer);
        morningTime.setMinutes(morningTime.getMinutes() + sessionDuration);
    }
    
    let eveningTime = new Date();
    eveningTime.setHours(16, 30, 0, 0);
    for (let i = 0; i < 4; i++) {
        createSlot(eveningTime.getHours(), eveningTime.getMinutes(), eveningShiftContainer);
        eveningTime.setMinutes(eveningTime.getMinutes() + sessionDuration);
    }
}

async function updateAvailableSlots(selectedDate) {
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.className = 'time-slot available';
    });
    const snapshot = await db.collection('bookings').where('date', '==', selectedDate).get();
    snapshot.forEach(doc => {
        const bookedSlot = document.querySelector(`.time-slot[data-time="${doc.data().time}"]`);
        if (bookedSlot) {
            bookedSlot.classList.remove('available');
            bookedSlot.classList.add('booked');
        }
    });
}

// --- الأحداث (Event Listeners) ---
dateInput.min = new Date().toISOString().split("T")[0];

dateInput.addEventListener('change', () => {
    const selectedDate = dateInput.value;
    if (selectedDate) {
        dateError.classList.add('hidden');
        generateTimeSlots();
        updateAvailableSlots(selectedDate);
        step2.classList.add('active');
        step3.classList.remove('active');
        selectedSlot = null;
    } else {
        dateError.classList.remove('hidden');
        step2.classList.remove('active');
    }
});

step2.addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('available')) {
        const previouslySelected = document.querySelector('.time-slot.selected');
        if (previouslySelected) {
            previouslySelected.classList.remove('selected');
        }
        target.classList.add('selected');
        selectedSlot = target.dataset.time;
        selectedTimeDisplay.innerText = `${selectedSlot} - بتاريخ ${dateInput.value}`;
        step3.classList.add('active');
        step3.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        fileNameDisplay.textContent = fileInput.files[0].name;
    } else {
        fileNameDisplay.textContent = 'رفع ملف (روشتة، تقرير)';
    }
});

bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedSlot || !dateInput.value) {
        alert('الرجاء اختيار تاريخ وموعد أولاً.');
        return;
    }
    
    loader.classList.remove('hidden');
    btnText.classList.add('hidden');
    submitBtn.disabled = true;

    const bookingData = {
        name: document.getElementById('full-name').value,
        phone: document.getElementById('phone-number').value,
        optionalPhone: document.getElementById('optional-phone-number').value,
        insurance: document.getElementById('insurance-company').value,
        date: dateInput.value,
        time: selectedSlot,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const filePath = `uploads/${Date.now()}_${file.name}`;
        const fileRef = storage.ref(filePath);
        try {
            const uploadTask = await fileRef.put(file);
            bookingData.fileURL = await uploadTask.ref.getDownloadURL();
        } catch (error) {
            console.error("File upload error:", error);
            alert("حدث خطأ أثناء رفع الملف.");
            loader.classList.add('hidden');
            btnText.classList.remove('hidden');
            submitBtn.disabled = false;
            return;
        }
    }

    try {
        await db.collection('bookings').add(bookingData);
        alert('تم تأكيد حجزك بنجاح! نتطلع لرؤيتك في PhysioCare.');
        bookingForm.reset();
        fileNameDisplay.textContent = 'رفع ملف (روشتة، تقرير)';
        step3.classList.remove('active');
        updateAvailableSlots(dateInput.value);
    } catch (error) {
        console.error("Booking error:", error);
        alert("فشل الحجز، يرجى المحاولة مرة أخرى.");
    } finally {
        loader.classList.add('hidden');
        btnText.classList.remove('hidden');
        submitBtn.disabled = false;
    }
});
