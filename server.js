require('dotenv').config(); // Carga las variables de entorno al inicio
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // Importa bcryptjs para hashear contraseñas

const app = express();
const PORT = process.env.PORT || 5000; // Usa el puerto del .env o 5000

// --- Middlewares ---
app.use(cors()); // Permite peticiones de diferentes orígenes (crucial para React frontend)
app.use(express.json()); // Permite al servidor parsear JSON en el cuerpo de las peticiones

// --- Conexión a MongoDB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Conectado a MongoDB Atlas');
    // Llama a la función para insertar bicicletas de ejemplo solo después de una conexión exitosa
    // insertSampleBikesForRent(); // Asegúrate de que esta función exista si la necesitas
    seedAdminUser(); // Llama a la función para asegurar que el admin exista
  })
  .catch(err => console.error('Error al conectar a MongoDB:', err));

// --- Modelos de Datos (Schemas con Mongoose) ---

// Modelo para los ítems del inventario (Bicicletas y Repuestos)
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true, enum: ['Bicicleta', 'Repuesto'] }, // 'Bicicleta' o 'Repuesto'
  type: { type: String },     // Para bicicletas (Urbana, Montaña, etc.)
  brand: { type: String },    // Para bicicletas
  partType: { type: String },   // Para repuestos (Cadena, Freno, etc.)
  compatibility: { type: String }, // Para repuestos (MTB, Ruta, Universal, etc.)
  price: { type: Number, required: true },
  stock: { type: Number, required: true, min: 0 },
  imageUrl: { type: String, default: 'https://via.placeholder.com/345x180?text=Producto' }, // Campo para imagen
}, { timestamps: true });
const InventoryItem = mongoose.model('InventoryItem', itemSchema);

// Modelo para bicicletas de arriendo (si lo usas, si no, puedes eliminarlo o adaptarlo)
const bikeForRentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  pricePerDay: { type: Number, required: true }, // <--- ¡Importante!
  imageUrl: { type: String },
  available: { type: Boolean, default: true },
});
const BikeForRent = mongoose.model('BikeForRent', bikeForRentSchema);

// Modelo para solicitudes de reparación
const repairRequestSchema = new mongoose.Schema({
  bikeType: { type: String, required: true },
  bikeBrand: { type: String, required: true },
  problemDescription: { type: String, required: true },
  contactName: { type: String, required: true },
  contactEmail: { type: String, required: true },
  contactPhone: { type: String },
  date: { type: Date, default: Date.now },
  status: { type: String, default: 'Pendiente', enum: ['Pendiente', 'En Proceso', 'Completada', 'Cancelada'] }
});
const RepairRequest = mongoose.model('RepairRequest', repairRequestSchema);

// Modelo para registros de arriendos (si lo usas)
// Modelo para los registros de arriendos (este es el "Rental" que necesitas)
const rentalSchema = new mongoose.Schema({
  bikeId: { type: mongoose.Schema.Types.ObjectId, ref: 'BikeForRent', required: true },
  bikeName: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalPrice: { type: Number, required: true },
  status: { type: String, default: 'Pendiente', enum: ['Pendiente', 'Activo', 'Completado', 'Cancelado'] },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String },
}, { timestamps: true });

const Rental = mongoose.model('Rental', rentalSchema);

// **********************************************
// NUEVO: Modelo de Usuario para Autenticación
// **********************************************
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Contraseña hasheada
  // Puedes añadir más campos como rol, fecha de registro, etc.
}, { timestamps: true });

// Middleware de Mongoose para hashear la contraseña antes de guardar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) { // Solo hashear si la contraseña ha sido modificada (o es nueva)
    return next();
  }
  const salt = await bcrypt.genSalt(10); // Genera un 'salt'
  this.password = await bcrypt.hash(this.password, salt); // Hashea la contraseña con el 'salt'
  next();
});

const User = mongoose.model('User', userSchema);

// **********************************************
// NUEVO: Modelo de Empleado para Autenticación
// **********************************************
const employeeSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    // Validación para asegurar que el correo termina en @masterbike.cl
    validate: {
      validator: function(v) {
        // Permite admin@masterbikeadmin.cl o cualquier @masterbike.cl
        return v.endsWith('@masterbike.cl') || v === 'admin@masterbikeadmin.cl';
      },
      message: props => `${props.value} no es un correo de empleado válido. Debe terminar en @masterbike.cl o ser admin@masterbikeadmin.cl`
    }
  },
  password: { type: String, required: true }, // Contraseña hasheada
  role: { type: String, default: 'employee', enum: ['employee', 'admin'] } // Rol para diferenciar de usuarios normales
}, { timestamps: true });

// Middleware de Mongoose para hashear la contraseña antes de guardar
employeeSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const Employee = mongoose.model('Employee', employeeSchema);

// Función para sembrar el usuario administrador
async function seedAdminUser() {
  try {
    const adminEmail = 'admin@masterbikeadmin.cl';
    const adminPassword = 'admin1234'; // La contraseña se hasheará automáticamente

    let adminUser = await Employee.findOne({ email: adminEmail });

    if (!adminUser) {
      adminUser = new Employee({
        firstName: 'Admin',
        lastName: 'Masterbike',
        email: adminEmail,
        password: adminPassword, // Se hasheará por el pre-save hook
        role: 'admin'
      });
      await adminUser.save();
      console.log('Usuario administrador creado exitosamente.');
    } else {
      console.log('El usuario administrador ya existe.');
    }
  } catch (err) {
    console.error('Error al sembrar el usuario administrador:', err);
  }
}


// **********************************************
// NUEVO: Modelo para Registros de Despacho
// **********************************************
const dispatchRecordSchema = new mongoose.Schema({
  purchaseDate: { type: Date, default: Date.now },
  deliveryDate: { type: Date, required: true },
  items: [
    {
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
      name: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      priceAtPurchase: { type: Number, required: true },
    }
  ],
  totalAmount: { type: Number, required: true },
  customerDetails: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    // Puedes añadir más campos de cliente si son necesarios (dirección, teléfono, etc.)
  },
  status: { type: String, default: 'Pendiente', enum: ['Pendiente', 'En Despacho', 'Despachado', 'Cancelado'] },
}, { timestamps: true });

const DispatchRecord = mongoose.model('DispatchRecord', dispatchRecordSchema);


// --- Rutas de API ---

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('API de Tienda de Bicicletas Funcionando!');
});

// **********************************************
// NUEVAS RUTAS DE AUTENTICACIÓN
// **********************************************

// POST: Ruta para registrar un nuevo usuario
app.post('/api/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    // 1. Verificar si el usuario ya existe
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'El usuario con ese correo ya existe.' });
    }

    // 2. Crear un nuevo usuario (el pre-save hook hasheará la contraseña)
    user = new User({
      firstName,
      lastName,
      email,
      password // La contraseña se hashea automáticamente por el middleware pre-save
    });

    await user.save();
    res.status(201).json({ message: 'Usuario registrado exitosamente', user: { id: user._id, email: user.email, firstName: user.firstName } });
  } catch (err) {
    console.error('Error en el registro:', err);
    res.status(500).json({ message: 'Error en el servidor al registrar el usuario.', error: err.message });
  }
});

// POST: Ruta para iniciar sesión de cliente
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Verificar si el usuario existe por email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas.' }); // Mensaje genérico por seguridad
    }

    // 2. Comparar la contraseña proporcionada con la contraseña hasheada en la BD
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas.' }); // Mensaje genérico por seguridad
    }

    // Si las credenciales son correctas
    res.status(200).json({
      message: 'Inicio de sesión exitoso',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });

  } catch (err) {
    console.error('Error en el inicio de sesión:', err);
    res.status(500).json({ message: 'Error en el servidor al iniciar sesión.', error: err.message });
  }
});

// **********************************************
// NUEVA RUTA: POST para iniciar sesión de empleado/administrador
// **********************************************
app.post('/api/employee-login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Buscar el empleado por email
    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(400).json({ message: 'Credenciales inválidas o empleado no encontrado.' });
    }

    // 2. Comparar la contraseña proporcionada con la contraseña hasheada
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas.' });
    }

    // Si las credenciales son correctas y el dominio es válido
    res.status(200).json({
      message: 'Inicio de sesión de empleado exitoso',
      employee: {
        id: employee._id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        role: employee.role // Incluye el rol en la respuesta
      }
    });

  } catch (err) {
    console.error('Error en el inicio de sesión de empleado:', err);
    res.status(500).json({ message: 'Error en el servidor al iniciar sesión de empleado.', error: err.message });
  }
});

// **********************************************
// NUEVA RUTA: POST para registrar un nuevo empleado (PROTEGIDA POR ADMIN)
// **********************************************
app.post('/api/employee-register', async (req, res) => {
  const { firstName, lastName, email, password, adminEmail, adminPassword } = req.body;

  try {
    // 1. Autenticar al administrador
    if (adminEmail !== 'admin@masterbikeadmin.cl') {
      return res.status(403).json({ message: 'Acceso denegado. Solo el administrador puede registrar nuevos empleados.' });
    }

    const adminUser = await Employee.findOne({ email: adminEmail, role: 'admin' });
    if (!adminUser) {
      return res.status(403).json({ message: 'Acceso denegado. Credenciales de administrador inválidas.' });
    }

    const isPasswordMatch = await bcrypt.compare(adminPassword, adminUser.password);
    if (!isPasswordMatch) {
      return res.status(403).json({ message: 'Acceso denegado. Contraseña de administrador incorrecta.' });
    }

    // 2. Verificar si el correo del nuevo empleado termina en @masterbike.cl
    if (!email.endsWith('@masterbike.cl')) {
      return res.status(400).json({ message: 'El correo del nuevo empleado debe terminar en @masterbike.cl' });
    }

    // 3. Verificar si el empleado ya existe
    let employee = await Employee.findOne({ email });
    if (employee) {
      return res.status(400).json({ message: 'Ya existe un empleado con ese correo.' });
    }

    // 4. Crear un nuevo empleado (el pre-save hook hasheará la contraseña)
    employee = new Employee({
      firstName,
      lastName,
      email,
      password,
      role: 'employee' // Asignar el rol de empleado por defecto
    });

    await employee.save();
    res.status(201).json({ message: 'Empleado registrado exitosamente', employee: { id: employee._id, email: employee.email, firstName: employee.firstName, role: employee.role } });
  } catch (err) {
    console.error('Error en el registro de empleado:', err);
    res.status(500).json({ message: 'Error en el servidor al registrar el empleado.', error: err.message });
  }
});


// Rutas para InventoryItem (ya existentes)
// GET all inventory items
app.get('/api/inventory', async (req, res) => {
  try {
    const items = await InventoryItem.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new inventory item
app.post('/api/inventory', async (req, res) => {
  const item = new InventoryItem(req.body);
  try {
    const newItem = await item.save();
    res.status(201).json(newItem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT (update) an inventory item
app.put('/api/inventory/:id', async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Ítem de inventario no encontrado' });
    }
    Object.assign(item, req.body); // Actualiza solo los campos presentes en req.body
    const updatedItem = await item.save();
    res.json(updatedItem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE an inventory item
app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const item = await InventoryItem.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Ítem de inventario no encontrado' });
    }
    res.json({ message: 'Ítem de inventario eliminado' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Rutas para RepairRequest (ya existentes)
// GET all repair requests
app.get('/api/repairs', async (req, res) => {
  try {
    const repairs = await RepairRequest.find();
    res.json(repairs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new repair request
app.post('/api/repairs', async (req, res) => {
  const repair = new RepairRequest({
    bikeType: req.body.bikeType,
    bikeBrand: req.body.bikeBrand,
    problemDescription: req.body.problemDescription,
    contactName: req.body.contactName,
    contactEmail: req.body.contactEmail,
    contactPhone: req.body.contactPhone,
    status: req.body.status || 'Pendiente',
  });

  try {
    const newRepair = await repair.save();
    res.status(201).json(newRepair); // 201 Created
  } catch (err) {
    res.status(400).json({ message: err.message }); // 400 Bad Request por errores de validación
  }
});

// PUT (update) repair status
app.put('/api/repairs/:id', async (req, res) => {
  try {
    const repair = await RepairRequest.findById(req.params.id);
    if (!repair) {
      return res.status(404).json({ message: 'Solicitud de reparación no encontrada' });
    }

    if (req.body.status) {
      repair.status = req.body.status;
    }
    // Puedes añadir más campos para actualizar aquí si es necesario

    const updatedRepair = await repair.save();
    res.json(updatedRepair);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a repair request
app.delete('/api/repairs/:id', async (req, res) => {
  try {
    const repair = await RepairRequest.findByIdAndDelete(req.params.id);
    if (!repair) {
      return res.status(404).json({ message: 'Solicitud de reparación no encontrada' });
    }
    res.json({ message: 'Solicitud de reparación eliminada' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Rutas para bicicletas de arriendo (si usas BikeForRent)
app.get('/api/bikes', async (req, res) => {
  try {
    const bikes = await BikeForRent.find();
    res.json(bikes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Rutas para registros de arriendos (si usas Rental)
app.post('/api/rentals', async (req, res) => {
  const rental = new Rental({
    bikeId: req.body.bikeId,
    bikeName: req.body.bikeName,
    startDate: new Date(req.body.startDate),
    endDate: new Date(req.body.endDate),
    totalPrice: req.body.totalPrice,
    status: req.body.status || 'Pendiente',
    customerName: req.body.customerName,
    customerEmail: req.body.customerEmail,
    customerPhone: req.body.customerPhone,
  });

  try {
    const newRental = await rental.save();
    res.status(201).json(newRental);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// **********************************************
// NUEVA RUTA PARA PROCESAR LA COMPRA (DEDUCCIÓN DE INVENTARIO Y REGISTRO DE DESPACHO)
// **********************************************
app.post('/api/purchase', async (req, res) => {
  const { cartItems, deliveryDate, customerName, customerEmail } = req.body;

  if (!cartItems || cartItems.length === 0) {
    return res.status(400).json({ message: 'El carrito está vacío.' });
  }
  if (!deliveryDate || !customerName || !customerEmail) {
    return res.status(400).json({ message: 'Faltan detalles de la compra (fecha de despacho, nombre o email del cliente).' });
  }

  let session;
  try {
    // Iniciar una sesión de transacción para asegurar la atomicidad
    session = await mongoose.startSession();
    session.startTransaction();

    const dispatchItems = [];
    let totalPurchaseAmount = 0;

    for (const item of cartItems) {
      const { _id: itemId, quantity, price } = item;

      // 1. Buscar el ítem en el inventario
      const inventoryItem = await InventoryItem.findById(itemId).session(session);

      if (!inventoryItem) {
        throw new Error(`Producto con ID ${itemId} no encontrado en el inventario.`);
      }

      // 2. Verificar stock disponible
      if (inventoryItem.stock < quantity) {
        throw new Error(`Stock insuficiente para el producto: ${inventoryItem.name}. Disponible: ${inventoryItem.stock}, Solicitado: ${quantity}`);
      }

      // 3. Deducir stock
      inventoryItem.stock -= quantity;
      await inventoryItem.save({ session });

      // Preparar ítems para el registro de despacho
      dispatchItems.push({
        itemId: inventoryItem._id,
        name: inventoryItem.name,
        quantity: quantity,
        priceAtPurchase: price, // Usamos el precio del carrito para el registro
      });
      totalPurchaseAmount += price * quantity;
    }

    // 4. Crear el registro de despacho
    const newDispatchRecord = new DispatchRecord({
      items: dispatchItems,
      totalAmount: totalPurchaseAmount,
      deliveryDate: new Date(deliveryDate),
      customerDetails: {
        name: customerName,
        email: customerEmail,
      },
      status: 'Pendiente', // El estado inicial del despacho
    });
    await newDispatchRecord.save({ session });

    // 5. Confirmar la transacción
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Compra procesada y stock actualizado. Registro de despacho creado.', dispatchRecord: newDispatchRecord });

  } catch (err) {
    // Si hay un error, abortar la transacción para revertir los cambios
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error('Error al procesar la compra:', err);
    res.status(500).json({ message: 'Error al procesar la compra: ' + err.message });
  }
});



// --- Iniciar el servidor ---
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
