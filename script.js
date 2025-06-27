// --- الإعداد المبدئي ---
// 1. اذهب إلى https://firebase.google.com/
// 2. أنشئ مشروعًا جديدًا.
// 3. من لوحة تحكم المشروع، اذهب إلى إعدادات المشروع (Project settings).
// 4. تحت تبويب "General"، انزل للأسفل إلى "Your apps" واختر أيقونة الويب (</>).
// 5. سجل تطبيقك وستحصل على firebaseConfig. انسخها والصقها هنا.

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// --- عناصر الصفحة ---
const dateInput = document.getElementById('session-date');
const morningShiftContainer = document.getElementById('morning-shift');
const eveningShiftContainer = document.getElementById('evening-shift');
const shiftsContainer = document.getElementById('shifts-container');
const bookingFormContainer = document.getElementById('booking-form-container');
const selectedTimeDisplay = document.getElementById('selected-time-display');
const bookingForm = document.getElementById('booking-form');
const submitBtn = document.getElementById('submit-booking-btn');
const loader = document.getElementById('loader');

// --- إعدادات المواعيد ---
const sessionDuration = 40; // دقائق
let selectedSlot = null;

// --- وظائف ---

// دالة لتوليد المواعيد
function generateTimeSlots() {
    // إفراغ الحاويات
    morningShiftContainer.innerHTML = '';
    eveningShiftContainer.innerHTML = '';

    const createSlot = (hour, minute, shift) => {
        const time = new Date();
        time.setHours(hour, minute, 0, 0);
        const timeString = time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        
        const slot = document.createElement('div');
        slot.classList.add('time-slot', 'available');
        slot.dataset.time = timeString;
        slot.innerText = timeString;
        
        if (shift === 'morning') {
            morningShiftContainer.appendChild(slot);
        } else {
            eveningShiftContainer.appendChild(slot);
        }
    };
    
    // الشيفت الصباحي (من 10:30 إلى 16:10)
    let morningTime = new Date();
    morningTime.setHours(10, 30, 0, 0);
    for (let i = 0; i < 5; i++) { // 5 مواعيد صباحية (مثال)
        createSlot(morningTime.getHours(), morningTime.getMinutes(), 'morning');
        morningTime.setMinutes(morningTime.getMinutes() + sessionDuration);
    }
    
    // الشيفت المسائي (من 16:30 إلى 22:10)
    let eveningTime = new Date();
    eveningTime.setHours(16, 30, 0, 0);
    for (let i = 0; i < 4; i++) { // 4 مواعيد مسائية (مثال)
        createSlot(eveningTime.getHours(), eveningTime.getMinutes(), 'evening');
        eveningTime.setMinutes(eveningTime.getMinutes() + sessionDuration);
    }
}


// دالة لتحديث المواعيد المتاحة بناءً على حجوزات Firebase
async function updateAvailableSlots(selectedDate) {
    if (!selectedDate) return;
    
    // جعل كل المواعيد متاحة مبدئيًا
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('booked', 'selected');
        slot.classList.add('available');
    });

    // جلب الحجوزات من Firestore للتاريخ المحدد
    const bookingsRef = db.collection('bookings');
    const snapshot = await bookingsRef.where('date', '==', selectedDate).get();

    if (snapshot.empty) {
        console.log('لا توجد حجوزات لهذا اليوم.');
        return;
    }

    snapshot.forEach(doc => {
        const bookedTime = doc.data().time;
        const bookedSlot = document.querySelector(`.time-slot[data-time="${bookedTime}"]`);
        if (bookedSlot) {
            bookedSlot.classList.remove('available');
            bookedSlot.classList.add('booked');
        }
    });
}


// --- الأحداث (Event Listeners) ---

// تحديد تاريخ أدنى (اليوم)
dateInput.min = new Date().toISOString().split("T")[0];

// عند تغيير التاريخ
dateInput.addEventListener('change', () => {
    const selectedDate = dateInput.value;
    if (selectedDate) {
        generateTimeSlots();
        updateAvailableSlots(selectedDate);
        shiftsContainer.classList.remove('hidden');
        bookingFormContainer.classList.add('hidden'); // إخفاء الفورم عند تغيير اليوم
        selectedSlot = null;
    } else {
        shiftsContainer.classList.add('hidden');
    }
});


// عند اختيار موعد
shiftsContainer.addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('available')) {
        // إزالة التحديد السابق إن وجد
        const previouslySelected = document.querySelector('.time-slot.selected');
        if (previouslySelected) {
            previouslySelected.classList.remove('selected');
        }

        // تحديد الموعد الجديد
        target.classList.add('selected');
        selectedSlot = target.dataset.time;
        
        // إظهار الفورم
        bookingFormContainer.classList.remove('hidden');
        selectedTimeDisplay.innerText = `${selectedSlot} - بتاريخ ${dateInput.value}`;
        bookingFormContainer.scrollIntoView({ behavior: 'smooth' });
    }
});


// عند تقديم الفورم (الحجز)
bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!selectedSlot || !dateInput.value) {
        alert('الرجاء اختيار تاريخ وموعد أولاً.');
        return;
    }
    
    submitBtn.disabled = true;
    loader.classList.remove('hidden');

    // 1. جمع البيانات
    const bookingData = {
        name: document.getElementById('full-name').value,
        phone: document.getElementById('phone-number').value,
        optionalPhone: document.getElementById('optional-phone-number').value,
        insurance: document.getElementById('insurance-company').value,
        date: dateInput.value,
        time: selectedSlot,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // 2. رفع الملف إن وجد
    const file = document.getElementById('file-upload').files[0];
    if (file) {
        const filePath = `uploads/${Date.now()}_${file.name}`;
        const fileRef = storage.ref(filePath);
        try {
            const uploadTask = await fileRef.put(file);
            const downloadURL = await uploadTask.ref.getDownloadURL();
            bookingData.fileURL = downloadURL;
        } catch (error) {
            console.error("خطأ في رفع الملف: ", error);
            alert("حدث خطأ أثناء رفع الملف، يرجى المحاولة مرة أخرى.");
            submitBtn.disabled = false;
            loader.classList.add('hidden');
            return;
        }
    }

    // 3. حفظ بيانات الحجز في Firestore
    try {
        await db.collection('bookings').add(bookingData);
        alert('تم تأكيد حجزك بنجاح!');
        
        // إعادة تعيين الصفحة
        bookingForm.reset();
        bookingFormContainer.classList.add('hidden');
        updateAvailableSlots(dateInput.value); // تحديث المواعيد لإظهار الموعد الجديد كمحجوز

    } catch (error) {
        console.error("خطأ في الحجز: ", error);
        alert("فشل الحجز، يرجى المحاولة مرة أخرى.");
    } finally {
        submitBtn.disabled = false;
        loader.classList.add('hidden');
    }
});
