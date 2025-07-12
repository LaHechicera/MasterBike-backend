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
    // Llama a la función para asegurar que el admin exista
    seedAdminUser();
  })
  .catch(err => console.error('Error al conectar a MongoDB:', err));

// --- Modelos de Datos (Schemas con Mongoose) ---

// Modelo para los ítems del inventario (Bicicletas y Repuestos)
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true, enum: ['Bicicleta', 'Repuesto'] },
  type: { type: String }, // 'Bicicleta de Montaña', 'Ruta', 'Urbana', 'Manubrio', 'Pedal', etc.
  brand: { type: String },
  price: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
  partType: { type: String }, // Específico para repuestos (ej: 'Frenos', 'Transmisión')
  compatibility: { type: String }, // Específico para repuestos
  imageUrl: { type: String }, // URL de la imagen del producto
  isAvailableForRent: { type: Boolean, default: false }, // Para bicicletas disponibles para arriendo
});

const Item = mongoose.model('Item', itemSchema);

// Modelo para el usuario (incluye usuarios normales, empleados y administradores)
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  isEmployee: { type: Boolean, default: false },
});

const User = mongoose.model('User', userSchema);

// Modelo para Arriendos de Bicicletas
const rentalSchema = new mongoose.Schema({
  bikeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  bikeName: { type: String, required: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalPrice: { type: Number, required: true },
  status: { type: String, required: true, enum: ['Activo', 'Completado', 'Cancelado'], default: 'Activo' },
  createdAt: { type: Date, default: Date.now },
});

const Rental = mongoose.model('Rental', rentalSchema);

// Modelo para Órdenes de Reparación
const repairSchema = new mongoose.Schema({
  bikeType: { type: String, required: true },
  bikeBrand: { type: String },
  problemDescription: { type: String, required: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  status: { type: String, required: true, enum: ['Pendiente', 'En Proceso', 'Completada', 'Cancelada'], default: 'Pendiente' },
  createdAt: { type: Date, default: Date.now },
});

const Repair = mongoose.model('Repair', repairSchema);

// Modelo para Compras/Despachos
const purchaseSchema = new mongoose.Schema({
  items: [
    {
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
      quantity: { type: Number, required: true },
    }
  ],
  totalAmount: { type: Number, required: true },
  customerDetails: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String }, // Nueva: Dirección del cliente para el despacho
  },
  purchaseDate: { type: Date, default: Date.now },
});

const Purchase = mongoose.model('Purchase', purchaseSchema);

// Modelo para Registros de Despacho
const dispatchRecordSchema = new mongoose.Schema({
  items: [
    {
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
      name: { type: String, required: true }, // Nombre del ítem en el momento de la compra
      quantity: { type: Number, required: true },
      priceAtPurchase: { type: Number, required: true }, // Precio del ítem en el momento de la compra
    }
  ],
  totalAmount: { type: Number, required: true },
  deliveryDate: { type: Date, required: true }, // Fecha de despacho sugerida
  customerDetails: {
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  status: { type: String, required: true, enum: ['Pendiente', 'En Despacho', 'Entregado', 'Cancelado'], default: 'Pendiente' },
  createdAt: { type: Date, default: Date.now },
});

const DispatchRecord = mongoose.model('DispatchRecord', dispatchRecordSchema);

// Función para asegurar la existencia del usuario administrador
async function seedAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@masterbike.cl';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234'; // Considera usar una contraseña más segura en producción

  try {
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      // Si el administrador no existe, crearlo
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const newAdmin = new User({
        firstName: 'Admin',
        lastName: 'Masterbike',
        email: adminEmail,
        password: hashedPassword,
        isAdmin: true,
        isEmployee: true, // Un administrador también es un empleado
      });
      await newAdmin.save();
      console.log('Usuario administrador creado con éxito.');
    } else {
      console.log('El usuario administrador ya existe.');
    }
  } catch (error) {
    console.error('Error al sembrar el usuario administrador:', error);
  }
}

// --- Endpoints ---

// Endpoint de Login para usuarios
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas.' });
    }

    // Si el login es exitoso
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isAdmin: user.isAdmin,
      isEmployee: user.isEmployee,
    };
    res.status(200).json({ message: 'Inicio de sesión exitoso', user: userResponse });

  } catch (error) {
    console.error('Error en el inicio de sesión:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Endpoint de Login para Empleados (Añadido)
app.post('/api/employee/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Buscar al usuario por email
    const user = await User.findOne({ email });

    // 2. Verificar si el usuario existe
    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas.' });
    }

    // 3. Verificar si el usuario es un empleado o administrador
    if (!user.isEmployee && !user.isAdmin) {
      return res.status(403).json({ message: 'Acceso denegado. Solo empleados o administradores.' });
    }

    // 4. Comparar la contraseña ingresada con la contraseña hasheada
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas.' });
    }

    // 5. Autenticación exitosa
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isEmployee: user.isEmployee,
      isAdmin: user.isAdmin,
    };

    res.status(200).json({ message: 'Inicio de sesión de empleado exitoso', user: userResponse });

  } catch (error) {
    console.error('Error en el inicio de sesión de empleado:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Endpoint de Registro de usuarios
app.post('/api/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo electrónico ya está registrado.' });
    }

    // Hashear la contraseña antes de guardar
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el nuevo usuario
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      isAdmin: false,
      isEmployee: false,
    });

    await newUser.save();
    res.status(201).json({ message: 'Registro exitoso. Ahora puedes iniciar sesión.' });

  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Endpoint para obtener inventario (Bicicletas y Repuestos)
app.get('/api/inventory', async (req, res) => {
  try {
    const items = await Item.find({});
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el inventario.', error: error.message });
  }
});

// Endpoints para Gestión de Inventario (Solo para empleados o administradores)
// NOTA: En un entorno de producción, estos endpoints deberían estar protegidos con autenticación JWT para verificar el rol.

// POST /api/inventory - Añadir un nuevo ítem al inventario
app.post('/api/inventory', async (req, res) => {
  try {
    const newItem = new Item(req.body);
    await newItem.save();
    res.status(201).json({ message: 'Ítem añadido con éxito.', item: newItem });
  } catch (error) {
    res.status(400).json({ message: 'Error al añadir ítem.', error: error.message });
  }
});

// PUT /api/inventory/:id - Actualizar un ítem
app.put('/api/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedItem = await Item.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedItem) {
      return res.status(404).json({ message: 'Ítem no encontrado.' });
    }
    res.status(200).json({ message: 'Ítem actualizado con éxito.', item: updatedItem });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar ítem.', error: error.message });
  }
});

// DELETE /api/inventory/:id - Eliminar un ítem
app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedItem = await Item.findByIdAndDelete(id);
    if (!deletedItem) {
      return res.status(404).json({ message: 'Ítem no encontrado.' });
    }
    res.status(200).json({ message: 'Ítem eliminado con éxito.', item: deletedItem });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar ítem.', error: error.message });
  }
});

// Endpoint para obtener solo bicicletas
app.get('/api/bikes', async (req, res) => {
  try {
    // Busca ítems con category 'Bicicleta' y isAvailableForRent true
    const bikes = await Item.find({ category: 'Bicicleta', isAvailableForRent: true });
    res.status(200).json(bikes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener bicicletas.', error: error.message });
  }
});

// Endpoint para registrar un nuevo arriendo
app.post('/api/rentals', async (req, res) => {
  try {
    const { bikeId, bikeName, customerName, customerEmail, startDate, endDate, totalPrice } = req.body;

    // Validación básica de los datos
    if (!bikeId || !bikeName || !customerName || !customerEmail || !startDate || !endDate || totalPrice <= 0) {
      return res.status(400).json({ message: 'Todos los campos requeridos para el arriendo deben ser completados.' });
    }

    // Crear el nuevo registro de arriendo
    const newRental = new Rental({
      bikeId,
      bikeName,
      customerName,
      customerEmail,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      totalPrice,
      status: 'Activo', // Estado inicial
    });

    await newRental.save();
    res.status(201).json({ message: 'Arriendo registrado con éxito.', rental: newRental });

  } catch (error) {
    console.error('Error al registrar el arriendo:', error);
    res.status(500).json({ message: 'Error al registrar el arriendo.', error: error.message });
  }
});

// Endpoint para obtener todos los arriendos (para gestión)
app.get('/api/rentals', async (req, res) => {
  try {
    const rentals = await Rental.find({}).sort({ createdAt: -1 }); // Ordenar por fecha de creación descendente
    res.status(200).json(rentals);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los arriendos.', error: error.message });
  }
});

// Endpoint para actualizar el estado de un arriendo
app.put('/api/rentals/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const rental = await Rental.findByIdAndUpdate(
      id,
      { status },
      { new: true } // Devuelve el documento actualizado
    );

    if (!rental) {
      return res.status(404).json({ message: 'Arriendo no encontrado.' });
    }

    res.status(200).json({ message: 'Estado de arriendo actualizado con éxito.', rental });

  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar el estado del arriendo.', error: error.message });
  }
});

// Endpoint para registrar una nueva reparación
app.post('/api/repairs', async (req, res) => {
  try {
    const { bikeType, bikeBrand, problemDescription, customerName, customerEmail } = req.body;

    // Validación básica
    if (!bikeType || !problemDescription || !customerName || !customerEmail) {
      return res.status(400).json({ message: 'Por favor, complete todos los campos requeridos.' });
    }

    const newRepair = new Repair({
      bikeType,
      bikeBrand,
      problemDescription,
      customerName,
      customerEmail,
      status: 'Pendiente',
    });

    await newRepair.save();
    res.status(201).json({ message: 'Solicitud de reparación registrada con éxito.', repair: newRepair });

  } catch (error) {
    console.error('Error al registrar la reparación:', error);
    res.status(500).json({ message: 'Error interno del servidor al registrar la reparación.' });
  }
});

// Endpoint para obtener todas las reparaciones (para gestión)
app.get('/api/repairs', async (req, res) => {
  try {
    const repairs = await Repair.find({}).sort({ createdAt: -1 });
    res.status(200).json(repairs);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener las reparaciones.', error: error.message });
  }
});

// Endpoint para actualizar el estado de una reparación
app.put('/api/repairs/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const repair = await Repair.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!repair) {
      return res.status(404).json({ message: 'Reparación no encontrada.' });
    }

    res.status(200).json({ message: 'Estado de reparación actualizado con éxito.', repair });

  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar el estado de la reparación.', error: error.message });
  }
});

// Endpoint para procesar la compra de ítems
app.post('/api/purchase', async (req, res) => {
  const { cartItems, deliveryDate, customerName, customerEmail, customerAddress } = req.body;
  const session = await mongoose.startSession();

  try {
    // 1. Verificar si hay ítems en el carrito y si los detalles del cliente están completos
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: 'El carrito está vacío.' });
    }
    if (!customerName || !customerEmail || !customerAddress || !deliveryDate) {
      return res.status(400).json({ message: 'Por favor, complete todos los detalles de contacto y despacho.' });
    }

    session.startTransaction();

    const dispatchItems = [];
    let totalPurchaseAmount = 0;

    // 2. Verificar stock y actualizar inventario dentro de la transacción
    for (const cartItem of cartItems) {
      const { itemId, quantity, price } = cartItem;
      const inventoryItem = await Item.findById(itemId).session(session);

      if (!inventoryItem) {
        throw new Error(`Ítem con ID ${itemId} no encontrado.`);
      }

      if (inventoryItem.stock < quantity) {
        throw new Error(`Stock insuficiente para ${inventoryItem.name}. Stock disponible: ${inventoryItem.stock}`);
      }

      // 3. Actualizar el stock
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
        address: customerAddress
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

// Endpoint para obtener registros de despacho (para empleados/administradores)
app.get('/api/dispatch-records', async (req, res) => {
  try {
    // Ordenar por fecha de creación descendente
    const records = await DispatchRecord.find({}).sort({ createdAt: -1 });
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los registros de despacho.', error: error.message });
  }
});

// Endpoint para actualizar el estado de un registro de despacho
app.put('/api/dispatch-records/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const record = await DispatchRecord.findByIdAndUpdate(
      id,
      { status },
      { new: true } // Devuelve el documento actualizado
    );

    if (!record) {
      return res.status(404).json({ message: 'Registro de despacho no encontrado.' });
    }

    res.status(200).json({ message: 'Estado de despacho actualizado con éxito.', record });

  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar el estado del despacho.', error: error.message });
  }
});

// --- Servidor escuchando ---
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});