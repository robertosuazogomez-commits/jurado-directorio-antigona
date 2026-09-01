const express = require('express');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

app.use(express.json({ limit: '20kb' }));

app.use(
  express.static(path.join(__dirname, 'public'))
);


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get('/api/health', (_req, res) => {

  res.json({
    ok: true,
    supabaseConfigured: !!(
      SUPABASE_URL &&
      SUPABASE_KEY
    )
  });

});


/* =========================================================
   LEER VOTOS
========================================================= */

app.get('/api/votes', async (req, res) => {

  if (!SUPABASE_URL || !SUPABASE_KEY) {

    return res.status(500).json({
      ok: false,
      error: 'Supabase no está configurado en Render.'
    });

  }

  try {

    const params = new URLSearchParams({
      select:
        'id,presentacion,estudiante,bando,argumentacion,refutacion,actuacion,justificacion,evidencia,created_at',
      order: 'created_at.desc'
    });


    if (req.query.presentacion) {

      const numero =
        Number(req.query.presentacion);

      if (
        Number.isInteger(numero) &&
        numero >= 1 &&
        numero <= 20
      ) {

        params.set(
          'presentacion',
          'eq.' + numero
        );

      }

    }


    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/votaciones?${params.toString()}`,
      {
        method: 'GET',

        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );


    const text = await response.text();


    if (!response.ok) {

      console.error(
        'ERROR SUPABASE /votes:',
        response.status,
        text
      );


      return res.status(502).json({
        ok: false,
        error:
          `Supabase rechazó la consulta (${response.status}).`,
        details: text
      });

    }


    res.json({
      ok: true,
      votos: JSON.parse(text)
    });


  } catch (error) {

    console.error(
      'ERROR DE CONEXIÓN SUPABASE:',
      error
    );


    res.status(502).json({
      ok: false,
      error:
        'Error de conexión con Supabase.',
      details:
        error.message
    });

  }

});


/* =========================================================
   REGISTRAR VOTO
========================================================= */

app.post('/api/vote', async (req, res) => {

  if (!SUPABASE_URL || !SUPABASE_KEY) {

    return res.status(500).json({
      ok: false,
      error:
        'Supabase no está configurado en Render.'
    });

  }


  const {
    presentacion,
    estudiante,
    bando,
    argumentacion,
    refutacion,
    actuacion,
    justificacion,
    evidencia
  } = req.body || {};


  const p = Number(presentacion);

  const scores = [
    argumentacion,
    refutacion,
    actuacion
  ].map(Number);


  /* VALIDACIONES */

  if (
    !Number.isInteger(p) ||
    p < 1 ||
    p > 20
  ) {

    return res.status(400).json({
      ok: false,
      error:
        'Presentación inválida.'
    });

  }


  if (
    typeof estudiante !== 'string' ||
    estudiante.trim().length < 2 ||
    estudiante.trim().length > 100
  ) {

    return res.status(400).json({
      ok: false,
      error:
        'Nombre inválido.'
    });

  }


  if (!['A', 'B'].includes(bando)) {

    return res.status(400).json({
      ok: false,
      error:
        'Bando inválido.'
    });

  }


  if (
    scores.some(
      n =>
        !Number.isInteger(n) ||
        n < 1 ||
        n > 5
    )
  ) {

    return res.status(400).json({
      ok: false,
      error:
        'Puntuación inválida.'
    });

  }


  if (
    typeof justificacion !== 'string' ||
    justificacion.trim().length < 5 ||
    justificacion.trim().length > 2000
  ) {

    return res.status(400).json({
      ok: false,
      error:
        'Justificación inválida.'
    });

  }


  if (
    typeof evidencia !== 'string' ||
    evidencia.trim().length < 5 ||
    evidencia.trim().length > 2000
  ) {

    return res.status(400).json({
      ok: false,
      error:
        'Evidencia inválida.'
    });

  }


  /* INSERTAR EN SUPABASE */

  try {

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/votaciones`,
      {
        method: 'POST',

        headers: {
          apikey: SUPABASE_KEY,
          Authorization:
            `Bearer ${SUPABASE_KEY}`,

          'Content-Type':
            'application/json',

          Prefer:
            'return=minimal'
        },

        body: JSON.stringify({

          presentacion: p,

          estudiante:
            estudiante.trim(),

          bando,

          argumentacion:
            scores[0],

          refutacion:
            scores[1],

          actuacion:
            scores[2],

          justificacion:
            justificacion.trim(),

          evidencia:
            evidencia.trim()

        })

      }
    );


    const text =
      await response.text();


    if (!response.ok) {

      console.error(
        'ERROR SUPABASE INSERT:',
        response.status,
        text
      );


      return res.status(502).json({

        ok: false,

        error:
          'Supabase rechazó el registro del voto.',

        details:
          text

      });

    }


    console.log(
      'VOTO REGISTRADO:',
      {
        presentacion: p,
        estudiante: estudiante.trim(),
        bando
      }
    );


    return res.json({

      ok: true,

      message:
        'Veredicto registrado correctamente.'

    });


  } catch (error) {

    console.error(
      'ERROR DE CONEXIÓN CON SUPABASE:',
      error
    );


    return res.status(502).json({

      ok: false,

      error:
        'Error de conexión con Supabase.',

      details:
        error.message

    });

  }

});


/* =========================================================
   SERVIR LA APLICACIÓN
========================================================= */

app.get('*', (_req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      'public',
      'index.html'
    )
  );

});


/* =========================================================
   SERVIDOR
========================================================= */

app.listen(
  PORT,
  '0.0.0.0',
  () => {

    console.log(
      `Jurado del Directorio funcionando en puerto ${PORT}`
    );

  }
);
