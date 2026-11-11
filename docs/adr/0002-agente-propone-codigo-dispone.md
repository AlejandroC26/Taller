# ADR 0002. El agente propone, el código dispone

**Estado:** aceptada · **Fecha:** 2026-11-10

## Contexto

El taller usa un modelo de lenguaje local (Ollama, `llama3.2`) para el prediagnóstico. Lee lo
que el cliente le contó al concesionario y decide qué especialidad debe atender el carro.

El concesionario llama `prediagnosticar` mientras el cliente espera en el chat y necesita la
respuesta en menos de 30 segundos. Un modelo pequeño en CPU puede tardar más que eso, inventar
un servicio o dejarse manipular por el texto del cliente.

## Decisión

**El modelo propone y el código decide.**

1. **Salida estructurada.** El modelo responde un JSON con especialidad, servicios, confianza y resumen. `validarSalidaModelo` lo rechaza en tres casos:
   - si la especialidad no es una de las seis;
   - si la confianza no está entre 0 y 1;
   - si un servicio no existe en el catálogo, en cuyo caso descarta ese servicio.
2. **Tiempo máximo y plan B.** El modelo tiene 8 s por defecto, configurable hasta 22 s con `LOCAL_TIEMPO_MS`, y la herramienta completa tiene 28 s. Si el modelo no responde o responde algo inválido, deciden las reglas por palabras clave (`fuente: 'reglas'`). El servicio nunca se queda esperando.
3. **Contraste con las reglas.** Si el modelo duda (confianza < 0,6) y las reglas están más seguras, ganan las reglas.
4. **La ruta la decide el código.** Con confianza de 0,6 o más y una sede que tenga esa especialidad, el carro va a la sede especializada. Si no, va a revisión general, donde lo revisa un mecánico. En la duda gana la opción segura.
5. **El agente no tiene herramientas que cambien nada.** Los cambios de estado, la garantía y el dinero son del código y de las personas:
   - Los estados de la orden solo cambian por las transiciones de `ordenes/reglas.ts`.
   - El dictamen de garantía lo sugiere una tabla de causas (`garantias/reglas.ts`). El mecánico lo puede cambiar con un motivo y evidencia, y lo valida el concesionario.
   - El taller nunca cobra: eso es de facturación, que pide la aprobación del cliente por Telegram.
6. **Lo que escribe el cliente es un dato, no una instrucción.** El prompt lo dice, y aunque el modelo obedezca un texto malicioso, la salida pasa por los mismos filtros.

## Alternativas descartadas

- **Un agente libre con herramientas**, que agende, cambie estados o pida repuestos. Con un modelo de 3B en CPU es lento y poco confiable, y un error movería una orden real.
- **Solo reglas.** Son rápidas y seguras, pero no entienden una falla descrita con otras palabras (caso C12 de la evaluación).

## Consecuencias

- **En producción, en este equipo (CPU, `llama3.2`):** el modelo no alcanza a responder dentro del tope, así que deciden las reglas. La evaluación (`npm run evaluar`, 14 casos) da 13 aciertos y ningún error peligroso, es decir, ningún carro enviado a una sede especializada equivocada.
- **El modelo sin tope** (`npm run evaluar -- --sin-tope`) tarda entre 17 y 87 s por caso:
  - Acierta 9 de 14 y resuelve el caso C12, que las reglas no reconocen.
  - Comete 4 errores peligrosos con confianza alta: mezcla embrague y frenos, envía a frenos un caso de varios sistemas, confunde alternador con frenos y obedece la instrucción inyectada del caso C14.
  - El contraste del punto 3 no los detiene, porque solo actúa cuando el modelo duda.
- **Deuda conocida:** para que un modelo más rápido no lleve esos errores a producción, el contraste debe actuar también cuando el modelo y las reglas no coinciden. En ese caso, el carro debe ir a revisión general.
- **Mejoras posibles:** un modelo con GPU o en la nube, un prompt más corto, o RAG sobre la base de fallas para los casos que las palabras clave no reconocen.
