const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'access_control.sqlite');
const db = new Database(dbPath);

const matriculasMasivas = [
  // --- FLOTA DE EMPRESA Y DIRECCIÓN (40) ---
  { plate: '1001BBB', owner_name: 'Vehículo Empresa 01' }, { plate: '1002BBB', owner_name: 'Vehículo Empresa 02' },
  { plate: '1003BBB', owner_name: 'Vehículo Empresa 03' }, { plate: '1004BBB', owner_name: 'Vehículo Empresa 04' },
  { plate: '1005BBB', owner_name: 'Vehículo Empresa 05' }, { plate: '1006BBB', owner_name: 'Vehículo Empresa 06' },
  { plate: '1007BBB', owner_name: 'Vehículo Empresa 07' }, { plate: '1008BBB', owner_name: 'Vehículo Empresa 08' },
  { plate: '1009BBB', owner_name: 'Vehículo Empresa 09' }, { plate: '1010BBB', owner_name: 'Vehículo Empresa 10' },
  { plate: '1011BBB', owner_name: 'Vehículo Empresa 11' }, { plate: '1012BBB', owner_name: 'Vehículo Empresa 12' },
  { plate: '1013BBB', owner_name: 'Vehículo Empresa 13' }, { plate: '1014BBB', owner_name: 'Vehículo Empresa 14' },
  { plate: '1015BBB', owner_name: 'Vehículo Empresa 15' }, { plate: '1016BBB', owner_name: 'Vehículo Empresa 16' },
  { plate: '1017BBB', owner_name: 'Vehículo Empresa 17' }, { plate: '1018BBB', owner_name: 'Vehículo Empresa 18' },
  { plate: '1019BBB', owner_name: 'Vehículo Empresa 19' }, { plate: '1020BBB', owner_name: 'Vehículo Empresa 20' },
  { plate: '1021BBB', owner_name: 'Coche Sustitución 01' }, { plate: '1022BBB', owner_name: 'Coche Sustitución 02' },
  { plate: '1023BBB', owner_name: 'Coche Sustitución 03' }, { plate: '1024BBB', owner_name: 'Coche Sustitución 04' },
  { plate: '1025BBB', owner_name: 'Coche Sustitución 05' }, { plate: '1026BBB', owner_name: 'Coche Sustitución 06' },
  { plate: '1027BBB', owner_name: 'Coche Sustitución 07' }, { plate: '1028BBB', owner_name: 'Coche Sustitución 08' },
  { plate: '1029BBB', owner_name: 'Coche Sustitución 09' }, { plate: '1030BBB', owner_name: 'Coche Sustitución 10' },
  { plate: '1031BBB', owner_name: 'Dirección Comercial' }, { plate: '1032BBB', owner_name: 'Dirección RRHH' },
  { plate: '1033BBB', owner_name: 'Dirección Financiera' }, { plate: '1034BBB', owner_name: 'Dirección General' },
  { plate: '1035BBB', owner_name: 'Dirección Operaciones' }, { plate: '1036BBB', owner_name: 'Dirección IT' },
  { plate: '1037BBB', owner_name: 'Dirección Marketing' }, { plate: '1038BBB', owner_name: 'Dirección Compras' },
  { plate: '1039BBB', owner_name: 'Vehículo Eléctrico 01' }, { plate: '1040BBB', owner_name: 'Vehículo Eléctrico 02' },

  // --- EMPLEADOS - TURNO MAÑANA (40) ---
  { plate: '2001CCC', owner_name: 'Empleado TM - 001' }, { plate: '2002CCC', owner_name: 'Empleado TM - 002' },
  { plate: '2003CCC', owner_name: 'Empleado TM - 003' }, { plate: '2004CCC', owner_name: 'Empleado TM - 004' },
  { plate: '2005CCC', owner_name: 'Empleado TM - 005' }, { plate: '2006CCC', owner_name: 'Empleado TM - 006' },
  { plate: '2007CCC', owner_name: 'Empleado TM - 007' }, { plate: '2008CCC', owner_name: 'Empleado TM - 008' },
  { plate: '2009CCC', owner_name: 'Empleado TM - 009' }, { plate: '2010CCC', owner_name: 'Empleado TM - 010' },
  { plate: '2011CCC', owner_name: 'Empleado TM - 011' }, { plate: '2012CCC', owner_name: 'Empleado TM - 012' },
  { plate: '2013CCC', owner_name: 'Empleado TM - 013' }, { plate: '2014CCC', owner_name: 'Empleado TM - 014' },
  { plate: '2015CCC', owner_name: 'Empleado TM - 015' }, { plate: '2016CCC', owner_name: 'Empleado TM - 016' },
  { plate: '2017CCC', owner_name: 'Empleado TM - 017' }, { plate: '2018CCC', owner_name: 'Empleado TM - 018' },
  { plate: '2019CCC', owner_name: 'Empleado TM - 019' }, { plate: '2020CCC', owner_name: 'Empleado TM - 020' },
  { plate: '2021CCC', owner_name: 'Empleado TM - 021' }, { plate: '2022CCC', owner_name: 'Empleado TM - 022' },
  { plate: '2023CCC', owner_name: 'Empleado TM - 023' }, { plate: '2024CCC', owner_name: 'Empleado TM - 024' },
  { plate: '2025CCC', owner_name: 'Empleado TM - 025' }, { plate: '2026CCC', owner_name: 'Empleado TM - 026' },
  { plate: '2027CCC', owner_name: 'Empleado TM - 027' }, { plate: '2028CCC', owner_name: 'Empleado TM - 028' },
  { plate: '2029CCC', owner_name: 'Empleado TM - 029' }, { plate: '2030CCC', owner_name: 'Empleado TM - 030' },
  { plate: '2031CCC', owner_name: 'Empleado TM - 031' }, { plate: '2032CCC', owner_name: 'Empleado TM - 032' },
  { plate: '2033CCC', owner_name: 'Empleado TM - 033' }, { plate: '2034CCC', owner_name: 'Empleado TM - 034' },
  { plate: '2035CCC', owner_name: 'Empleado TM - 035' }, { plate: '2036CCC', owner_name: 'Empleado TM - 036' },
  { plate: '2037CCC', owner_name: 'Empleado TM - 037' }, { plate: '2038CCC', owner_name: 'Empleado TM - 038' },
  { plate: '2039CCC', owner_name: 'Empleado TM - 039' }, { plate: '2040CCC', owner_name: 'Empleado TM - 040' },

  // --- EMPLEADOS - TURNO TARDE Y NOCHE (40) ---
  { plate: '3001DDD', owner_name: 'Empleado TT - 001' }, { plate: '3002DDD', owner_name: 'Empleado TT - 002' },
  { plate: '3003DDD', owner_name: 'Empleado TT - 003' }, { plate: '3004DDD', owner_name: 'Empleado TT - 004' },
  { plate: '3005DDD', owner_name: 'Empleado TT - 005' }, { plate: '3006DDD', owner_name: 'Empleado TT - 006' },
  { plate: '3007DDD', owner_name: 'Empleado TT - 007' }, { plate: '3008DDD', owner_name: 'Empleado TT - 008' },
  { plate: '3009DDD', owner_name: 'Empleado TT - 009' }, { plate: '3010DDD', owner_name: 'Empleado TT - 010' },
  { plate: '3011DDD', owner_name: 'Empleado TT - 011' }, { plate: '3012DDD', owner_name: 'Empleado TT - 012' },
  { plate: '3013DDD', owner_name: 'Empleado TT - 013' }, { plate: '3014DDD', owner_name: 'Empleado TT - 014' },
  { plate: '3015DDD', owner_name: 'Empleado TT - 015' }, { plate: '3016DDD', owner_name: 'Empleado TT - 016' },
  { plate: '3017DDD', owner_name: 'Empleado TT - 017' }, { plate: '3018DDD', owner_name: 'Empleado TT - 018' },
  { plate: '3019DDD', owner_name: 'Empleado TT - 019' }, { plate: '3020DDD', owner_name: 'Empleado TT - 020' },
  { plate: '3021DDD', owner_name: 'Empleado TN - 001' }, { plate: '3022DDD', owner_name: 'Empleado TN - 002' },
  { plate: '3023DDD', owner_name: 'Empleado TN - 003' }, { plate: '3024DDD', owner_name: 'Empleado TN - 004' },
  { plate: '3025DDD', owner_name: 'Empleado TN - 005' }, { plate: '3026DDD', owner_name: 'Empleado TN - 006' },
  { plate: '3027DDD', owner_name: 'Empleado TN - 007' }, { plate: '3028DDD', owner_name: 'Empleado TN - 008' },
  { plate: '3029DDD', owner_name: 'Empleado TN - 009' }, { plate: '3030DDD', owner_name: 'Empleado TN - 010' },
  { plate: '3031DDD', owner_name: 'Empleado TN - 011' }, { plate: '3032DDD', owner_name: 'Empleado TN - 012' },
  { plate: '3033DDD', owner_name: 'Empleado TN - 013' }, { plate: '3034DDD', owner_name: 'Empleado TN - 014' },
  { plate: '3035DDD', owner_name: 'Empleado TN - 015' }, { plate: '3036DDD', owner_name: 'Empleado TN - 016' },
  { plate: '3037DDD', owner_name: 'Empleado TN - 017' }, { plate: '3038DDD', owner_name: 'Empleado TN - 018' },
  { plate: '3039DDD', owner_name: 'Empleado TN - 019' }, { plate: '3040DDD', owner_name: 'Empleado TN - 020' },

  // --- PROVEEDORES, MANTENIMIENTO Y SERVICIOS EXTERNOS (40) ---
  { plate: '4001FFF', owner_name: 'Proveedor Limpieza 01' }, { plate: '4002FFF', owner_name: 'Proveedor Limpieza 02' },
  { plate: '4003FFF', owner_name: 'Proveedor Limpieza 03' }, { plate: '4004FFF', owner_name: 'Proveedor Limpieza 04' },
  { plate: '4005FFF', owner_name: 'Proveedor Limpieza 05' }, { plate: '4006FFF', owner_name: 'Mantenimiento Clima 01' },
  { plate: '4007FFF', owner_name: 'Mantenimiento Clima 02' }, { plate: '4008FFF', owner_name: 'Mantenimiento Clima 03' },
  { plate: '4009FFF', owner_name: 'Mantenimiento Eléctrico 01' }, { plate: '4010FFF', owner_name: 'Mantenimiento Eléctrico 02' },
  { plate: '4011FFF', owner_name: 'Mantenimiento Ascensores 01' }, { plate: '4012FFF', owner_name: 'Mantenimiento Ascensores 02' },
  { plate: '4013FFF', owner_name: 'Servicios Informáticos 01' }, { plate: '4014FFF', owner_name: 'Servicios Informáticos 02' },
  { plate: '4015FFF', owner_name: 'Servicios Informáticos 03' }, { plate: '4016FFF', owner_name: 'Proveedor Catering 01' },
  { plate: '4017FFF', owner_name: 'Proveedor Catering 02' }, { plate: '4018FFF', owner_name: 'Proveedor Catering 03' },
  { plate: '4019FFF', owner_name: 'Control de Plagas 01' }, { plate: '4020FFF', owner_name: 'Control de Plagas 02' },
  { plate: '4021FFF', owner_name: 'Seguridad Privada 01' }, { plate: '4022FFF', owner_name: 'Seguridad Privada 02' },
  { plate: '4023FFF', owner_name: 'Seguridad Privada 03' }, { plate: '4024FFF', owner_name: 'Seguridad Privada 04' },
  { plate: '4025FFF', owner_name: 'Jardinería y Exteriores 01' }, { plate: '4026FFF', owner_name: 'Jardinería y Exteriores 02' },
  { plate: '4027FFF', owner_name: 'Auditoría Externa 01' }, { plate: '4028FFF', owner_name: 'Auditoría Externa 02' },
  { plate: '4029FFF', owner_name: 'Gestoría Externa 01' }, { plate: '4030FFF', owner_name: 'Prevención Riesgos 01' },
  { plate: '4031FFF', owner_name: 'Servicio Médico 01' }, { plate: '4032FFF', owner_name: 'Servicio Médico 02' },
  { plate: '4033FFF', owner_name: 'Mantenimiento Maquinaria 01' }, { plate: '4034FFF', owner_name: 'Mantenimiento Maquinaria 02' },
  { plate: '4035FFF', owner_name: 'Mantenimiento Maquinaria 03' }, { plate: '4036FFF', owner_name: 'Mantenimiento Maquinaria 04' },
  { plate: '4037FFF', owner_name: 'Mantenimiento Maquinaria 05' }, { plate: '4038FFF', owner_name: 'Recogida Residuos 01' },
  { plate: '4039FFF', owner_name: 'Recogida Residuos 02' }, { plate: '4040FFF', owner_name: 'Soporte Telecomunicaciones' },

  // --- LOGÍSTICA, TRANSPORTE Y VISITAS RECURRENTES (40) ---
  { plate: '5001HHH', owner_name: 'Logística Norte Camión 01' }, { plate: '5002HHH', owner_name: 'Logística Norte Camión 02' },
  { plate: '5003HHH', owner_name: 'Logística Norte Camión 03' }, { plate: '5004HHH', owner_name: 'Logística Norte Camión 04' },
  { plate: '5005HHH', owner_name: 'Logística Sur Furgón 01' }, { plate: '5006HHH', owner_name: 'Logística Sur Furgón 02' },
  { plate: '5007HHH', owner_name: 'Logística Sur Furgón 03' }, { plate: '5008HHH', owner_name: 'Logística Sur Furgón 04' },
  { plate: '5009HHH', owner_name: 'Reparto Paquetería A - 01' }, { plate: '5010HHH', owner_name: 'Reparto Paquetería A - 02' },
  { plate: '5011HHH', owner_name: 'Reparto Paquetería A - 03' }, { plate: '5012HHH', owner_name: 'Reparto Paquetería B - 01' },
  { plate: '5013HHH', owner_name: 'Reparto Paquetería B - 02' }, { plate: '5014HHH', owner_name: 'Reparto Paquetería B - 03' },
  { plate: '5015HHH', owner_name: 'Transportes Rápidos 01' }, { plate: '5016HHH', owner_name: 'Transportes Rápidos 02' },
  { plate: '5017HHH', owner_name: 'Transportes Rápidos 03' }, { plate: '5018HHH', owner_name: 'Transporte Pesado 01' },
  { plate: '5019HHH', owner_name: 'Transporte Pesado 02' }, { plate: '5020HHH', owner_name: 'Transporte Pesado 03' },
  { plate: '5021HHH', owner_name: 'Visita Comercial - A.García' }, { plate: '5022HHH', owner_name: 'Visita Comercial - B.López' },
  { plate: '5023HHH', owner_name: 'Visita Comercial - C.Martín' }, { plate: '5024HHH', owner_name: 'Visita Comercial - D.Ruiz' },
  { plate: '5025HHH', owner_name: 'Visita Comercial - E.Sánchez' }, { plate: '5026HHH', owner_name: 'Visita Comercial - F.Pérez' },
  { plate: '5027HHH', owner_name: 'Visita Institucional 01' }, { plate: '5028HHH', owner_name: 'Visita Institucional 02' },
  { plate: '5029HHH', owner_name: 'Visita Institucional 03' }, { plate: '5030HHH', owner_name: 'Visita Institucional 04' },
  { plate: '5031HHH', owner_name: 'Vehículo Compartido A' }, { plate: '5032HHH', owner_name: 'Vehículo Compartido B' },
  { plate: '5033HHH', owner_name: 'Vehículo Compartido C' }, { plate: '5034HHH', owner_name: 'Vehículo Compartido D' },
  { plate: '5035HHH', owner_name: 'Inspector Calidad 01' }, { plate: '5036HHH', owner_name: 'Inspector Calidad 02' },
  { plate: '5037HHH', owner_name: 'Asesoría Externa' }, { plate: '5038HHH', owner_name: 'Abogados Asociados' },
  { plate: '5039HHH', owner_name: 'Consultoría Estratégica' }, { plate: '5040HHH', owner_name: 'Visita VIP / Gerencia' }
];

const insertStmt = db.prepare(`
    INSERT INTO whitelist (plate, owner_name, valid_until)
    VALUES (?, ?, ?)
    ON CONFLICT(plate) DO UPDATE SET owner_name = excluded.owner_name
`);

const insertMany = db.transaction((lista) => {
  for (const item of lista) {
    insertStmt.run(item.plate, item.owner_name, null); // Propiedad correcta
  }
});

console.log(`Iniciando importación masiva de ${matriculasMasivas.length} matrículas...`);

try {
  insertMany(matriculasMasivas);
  console.log('✅ Importación masiva completada con éxito en 1 sola transacción de escritura.');
} catch (error) {
  console.error('❌ Error crítico durante la importación:', error);
}
