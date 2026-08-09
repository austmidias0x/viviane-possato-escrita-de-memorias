(function () {
  'use strict';

  const root = document.querySelector('[data-h-experience]');
  if (!root) return;

  const body = document.body;
  const offer = body.dataset.offer;
  const quiz = root.querySelector('[data-h-quiz]');
  const steps = Array.from(root.querySelectorAll('[data-h-step]'));
  const result = root.querySelector('[data-h-result]');
  const progress = root.querySelector('[data-h-progress]');
  const progressFill = root.querySelector('[data-h-progress-fill]');
  const progressText = root.querySelector('[data-h-progress-text]');
  const liveCopy = document.querySelector('[data-h-live-copy]');
  const liveKicker = document.querySelector('[data-h-live-kicker]');
  const liveTitle = document.querySelector('[data-h-live-title]');
  const liveText = document.querySelector('[data-h-live-text]');
  const liveStatus = document.querySelector('[data-h-live-status]');
  const pageMarkers = Array.from(document.querySelectorAll('[data-h-page-marker]'));
  const totalSteps = steps.length;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const answers = {};
  let started = false;

  const content = {
    memorias: {
      defaults: {
        kicker: 'Esta página começa com você',
        title: 'Você tem uma lembrança em mente.',
        text: 'Responda a três perguntas. A página vai acompanhar as suas escolhas e mostrar um ponto de partida possível para a sua escrita.'
      },
      subjects: {
        pessoa: {
          label: 'uma pessoa importante para você',
          title: 'Comece descrevendo essa pessoa em uma cena.',
          text: 'Procure um gesto, uma frase ou uma situação em que essa pessoa apareça fazendo alguma coisa.',
          reply: 'Então vamos procurar uma cena pequena que mostre essa pessoa em ação.',
          focus: 'uma pessoa em uma cena específica'
        },
        fase: {
          label: 'uma fase da sua vida',
          title: 'Escolha uma cena que represente essa fase.',
          text: 'Escolha um dia, um encontro ou uma decisão que permita ao leitor acompanhar como aquele período era vivido por você.',
          reply: 'Vamos aproximar essa fase até encontrar um acontecimento que possa ser narrado.',
          focus: 'um acontecimento que represente essa fase'
        },
        lugar: {
          label: 'um lugar que continua presente na sua memória',
          title: 'Os detalhes do lugar podem iniciar o texto.',
          text: 'Comece pelo que havia ao redor: a luz, os objetos, os sons e as pessoas que ocupavam aquele espaço com você.',
          reply: 'Esse lugar já oferece um cenário. Agora vamos descobrir qual detalhe chama você de volta.',
          focus: 'um lugar reconstruído pelos detalhes'
        },
        familia: {
          label: 'uma história que circula na sua família',
          title: 'Reconstitua uma história repetida pela sua família.',
          text: 'Você pode separar o que ouviu, o que presenciou e o que ainda gostaria de perguntar antes de escrever a cena.',
          reply: 'Vamos encontrar a parte dessa história que você consegue contar a partir do seu olhar.',
          focus: 'uma história de família contada pelo seu olhar'
        }
      },
      signals: {
        imagem: {
          label: 'uma imagem',
          sentence: 'Uma imagem já oferece enquadramento, distância e objetos para descrever',
          reply: 'Observe o que está dentro dessa imagem, quem aparece e o que acontecia alguns minutos antes.',
          practice: 'descrever a imagem como se o leitor estivesse entrando nela'
        },
        frase: {
          label: 'uma frase ou uma voz',
          sentence: 'Uma frase pode recuperar o ritmo de uma conversa e a relação entre as pessoas',
          reply: 'Anote a frase como você a escuta e recupere onde ela era dita, por quem e em qual momento.',
          practice: 'escrever a frase e reconstruir a conversa ao redor dela'
        },
        sentido: {
          label: 'um cheiro, um som ou um sabor',
          sentence: 'Ao citar um cheiro, um som ou um sabor, você mostra o ambiente sem interromper a cena para explicá-lo',
          reply: 'Esse detalhe pode entrar na primeira linha e conduzir o restante da cena.',
          practice: 'começar pelo sentido que trouxe a lembrança de volta'
        },
        sentimento: {
          label: 'um sentimento difícil de explicar',
          sentence: 'Você pode mostrar um sentimento pelo gesto que fez ou pela frase que evitou naquele momento',
          reply: 'Procure o momento em que esse sentimento apareceu no que você fez, disse ou evitou dizer.',
          practice: 'mostrar o sentimento por meio de uma ação observável'
        }
      },
      blocks: {
        inicio: {
          label: 'escolher por onde começar',
          reply: 'O seu primeiro exercício pode ser curto: uma cena, um detalhe e dez minutos de escrita.',
          next: 'Escolher uma única cena e escrever durante dez minutos, sem tentar contar tudo de uma vez.',
          route: 'A Linha do Tempo ajuda a localizar acontecimentos e escolher qual deles pede uma página.'
        },
        palavras: {
          label: 'encontrar palavras que se pareçam com a sua voz',
          reply: 'A sua voz costuma aparecer quando você escreve como contaria a cena para alguém próximo.',
          next: 'Contar a cena em voz alta, registrar as expressões que você usa e levar esse ritmo para o texto.',
          route: 'As práticas de voz ajudam você a reconhecer a forma como já conta as próprias histórias.'
        },
        exposicao: {
          label: 'decidir o que pode permanecer íntimo',
          reply: 'Você escolhe o que escreve, o que compartilha e o que permanece guardado.',
          next: 'Escrever uma primeira versão somente para você e decidir depois se alguma parte será compartilhada.',
          route: 'O curso permite fazer as práticas no seu espaço, sem obrigação de publicar ou mostrar os textos.'
        },
        rotina: {
          label: 'manter uma rotina de escrita',
          reply: 'Uma prática delimitada ajuda a retomar a escrita mesmo nas semanas em que você dispõe de pouco tempo.',
          next: 'Reservar um intervalo curto para uma proposta específica, com começo e fim definidos.',
          route: 'Como o acesso é vitalício, você pode retomar as aulas e as práticas conforme a sua rotina.'
        }
      }
    },
    mentoria: {
      defaults: {
        kicker: 'Mapa do seu livro',
        title: 'A orientação muda conforme o material que você já escreveu.',
        text: 'Responda a quatro perguntas. O mapa vai registrar o estágio do projeto, o leitor, o ponto que exige orientação e a sua disponibilidade de investimento.'
      },
      stages: {
        ideia: {
          label: 'uma ideia ou um tema',
          title: 'Você pode recortar a ideia antes de organizar os capítulos.',
          text: 'O primeiro trabalho pode definir para quem o livro será escrito, qual questão ele acompanha e quais experiências ajudam a desenvolvê-la.',
          reply: 'O mapa começa pelo recorte: qual leitor você quer acompanhar e qual pergunta conduz o livro.',
          result: 'A ideia ainda está no começo, e a conversa pode avaliar o recorte que orientará a estrutura.'
        },
        notas: {
          label: 'anotações, aulas ou materiais espalhados',
          title: 'Você pode agrupar o material existente em uma sequência.',
          text: 'Ao agrupar as anotações por pergunta, caso e conceito, você começa a distinguir o que pertence a cada capítulo.',
          reply: 'O mapa vai considerar como esse material pode ser agrupado antes da escrita dos capítulos.',
          result: 'Você já tem matéria-prima, e a conversa pode avaliar como organizá-la em uma sequência de capítulos.'
        },
        capitulos: {
          label: 'alguns capítulos escritos',
          title: 'A leitura dos capítulos localiza as decisões de estrutura.',
          text: 'A leitura do conjunto ajuda a localizar repetições, lacunas e mudanças de direção antes que o manuscrito cresça.',
          reply: 'O mapa vai usar os capítulos existentes para localizar a decisão que mais afeta a continuidade.',
          result: 'Os capítulos já permitem avaliar a sequência, as lacunas e o trabalho necessário para continuar.'
        },
        manuscrito: {
          label: 'um primeiro manuscrito',
          title: 'O manuscrito permite revisar o livro como um conjunto.',
          text: 'A revisão pode observar o recorte, a ordem dos capítulos e o que cada parte entrega ao leitor antes do trabalho linha a linha.',
          reply: 'O mapa vai considerar a estrutura completa antes de indicar a próxima revisão.',
          result: 'O manuscrito permite uma leitura de conjunto para definir a ordem das próximas revisões.'
        }
      },
      readers: {
        profissionais: {
          label: 'profissionais da sua área',
          reply: 'Esse leitor precisa reconhecer situações de trabalho e entender como aplicar as ideias apresentadas.',
          direction: 'profissionais que reconhecem os problemas e os exemplos da sua área'
        },
        mudanca: {
          label: 'pessoas que vivem uma mudança específica',
          reply: 'Você pode organizar os capítulos pelas situações que essa pessoa enfrenta, pelas decisões que precisa tomar e pelas dúvidas que aparecem em cada etapa.',
          direction: 'pessoas que estão atravessando uma mudança específica'
        },
        comunidade: {
          label: 'clientes, alunos ou uma comunidade que já acompanha você',
          reply: 'As perguntas que esse público já faz podem ajudar a definir a ordem e a profundidade dos capítulos.',
          direction: 'pessoas que já conhecem o seu trabalho e querem aprofundar o tema'
        },
        indefinido: {
          label: 'um leitor que ainda precisa ser definido',
          reply: 'Definir o leitor será uma das primeiras decisões, porque ela muda os exemplos, a linguagem e a ordem do livro.',
          direction: 'um leitor que ainda precisa ser delimitado'
        }
      },
      obstacles: {
        recorte: {
          label: 'recortar o tema',
          reply: 'O recorte pode separar a pergunta central das ideias que pertencem a outros projetos.',
          work: 'Definir a pergunta central, o limite do tema e os critérios usados para escolher o conteúdo.'
        },
        estrutura: {
          label: 'organizar a sequência dos capítulos',
          reply: 'A sequência precisa mostrar por que um capítulo prepara o seguinte e o que o leitor compreende em cada etapa.',
          work: 'Mapear a função de cada capítulo e revisar a sequência antes de ampliar o manuscrito.'
        },
        continuidade: {
          label: 'manter a escrita entre uma etapa e outra',
          reply: 'Ao final de cada encontro, você pode sair com uma tarefa de escrita compatível com o tempo disponível até a próxima conversa.',
          work: 'Definir entregas de escrita compatíveis com a agenda e revisar o material produzido entre os encontros.'
        },
        revisao: {
          label: 'revisar o material existente',
          reply: 'A revisão começa pela função de cada parte, porque esse diagnóstico orienta o que deve ser mantido, movido ou desenvolvido.',
          work: 'Ler o conjunto, registrar as decisões estruturais e organizar a revisão por etapas.'
        }
      },
      finance: {
        disponivel: {
          label: 'disponibilidade para investir a partir de R$ 9.997',
          reply: 'A sua disponibilidade permite enviar o diagnóstico para Viviane avaliar o contexto do projeto.',
          qualified: true
        },
        planejar: {
          label: 'necessidade de planejar o investimento',
          reply: 'A síntese continuará disponível nesta página para orientar o próximo trabalho enquanto você se planeja.',
          qualified: false
        },
        momento: {
          label: 'um momento em que esse investimento não cabe',
          reply: 'A síntese continuará disponível, e o curso Escrita de Memórias pode ser uma forma de começar com práticas gravadas.',
          qualified: false
        }
      }
    }
  };

  function emit(eventName, details) {
    if (typeof window.vivianeTrack === 'function') {
      window.vivianeTrack(eventName, details || {});
    }
  }

  function scrollToElement(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  function focusHeading(container) {
    const heading = container && container.querySelector('[data-h-focus]');
    if (!heading) return;
    window.setTimeout(function () { heading.focus({ preventScroll: true }); }, reducedMotion.matches ? 0 : 360);
  }

  function updateLiveCopy(kicker, title, text, completed) {
    liveCopy.classList.remove('is-updating');
    void liveCopy.offsetWidth;
    liveKicker.textContent = kicker;
    liveTitle.textContent = title;
    liveText.textContent = text;
    liveCopy.classList.add('is-updating');
    liveStatus.textContent = 'A página foi personalizada após a resposta ' + completed + ' de ' + totalSteps + '.';
    pageMarkers.forEach(function (marker, index) {
      marker.classList.toggle('is-active', index < completed);
    });
  }

  function selectedValue(key) {
    return answers[key] || '';
  }

  function memoryView() {
    const data = content.memorias;
    const subject = data.subjects[selectedValue('origem')];
    const signal = data.signals[selectedValue('sinal')];
    const block = data.blocks[selectedValue('bloqueio')];
    const completed = Object.keys(answers).length;

    if (!subject) return Object.assign({ completed: 0 }, data.defaults);
    if (!signal) {
      return {
        completed: completed,
        kicker: 'O assunto da sua primeira página',
        title: subject.title,
        text: subject.text
      };
    }
    if (!block) {
      return {
        completed: completed,
        kicker: 'O detalhe escolhido para começar',
        title: signal.sentence + '.',
        text: 'Como você quer escrever sobre ' + subject.label + ', experimente ' + signal.practice + '.'
      };
    }

    return {
      completed: completed,
      kicker: 'O seu ponto de partida',
      title: 'Uma cena, um detalhe e um primeiro exercício.',
      text: 'Você quer escrever sobre ' + subject.label + '. ' + signal.sentence + ', e o primeiro passo pode ser ' + block.next.charAt(0).toLowerCase() + block.next.slice(1),
      subject: subject,
      signal: signal,
      block: block
    };
  }

  function mentorView() {
    const data = content.mentoria;
    const stage = data.stages[selectedValue('estagio')];
    const reader = data.readers[selectedValue('leitor')];
    const obstacle = data.obstacles[selectedValue('necessidade')];
    const finance = data.finance[selectedValue('investimento')];
    const completed = Object.keys(answers).length;

    if (!stage) return Object.assign({ completed: 0 }, data.defaults);
    if (!reader) {
      return {
        completed: completed,
        kicker: 'O estágio do projeto',
        title: stage.title,
        text: stage.text
      };
    }
    if (!obstacle) {
      return {
        completed: completed,
        kicker: 'O livro e o seu leitor',
        title: 'O projeto parte de ' + stage.label + '.',
        text: 'Você quer escrever para ' + reader.direction + '. Essa escolha orienta os exemplos, a linguagem e a profundidade de cada capítulo.'
      };
    }
    if (!finance) {
      return {
        completed: completed,
        kicker: 'A decisão que orienta o trabalho',
        title: 'O ponto principal agora é ' + obstacle.label + '.',
        text: obstacle.work + ' A mentoria avalia esse trabalho dentro do estágio atual do manuscrito.'
      };
    }

    return {
      completed: completed,
      kicker: finance.qualified ? 'Diagnóstico pronto para envio' : 'Síntese do diagnóstico pronta',
      title: finance.qualified ? 'Viviane já pode receber o contexto do seu livro.' : 'Você já tem um próximo trabalho definido.',
      text: stage.result + ' O foco indicado é ' + obstacle.label + ', considerando ' + reader.direction + '.',
      stage: stage,
      reader: reader,
      obstacle: obstacle,
      finance: finance
    };
  }

  function currentView() {
    return offer === 'memorias' ? memoryView() : mentorView();
  }

  function renderPersonalization() {
    const view = currentView();
    updateLiveCopy(view.kicker, view.title, view.text, view.completed);
    emit('personalization_step', {
      step: view.completed,
      next_step: Math.min(view.completed + 1, totalSteps),
      intent: steps.map(function (step) { return answers[step.dataset.hKey] || 'pending'; }).join('|')
    });
  }

  function updateProgress() {
    const completed = Object.keys(answers).length;
    const percent = Math.round((completed / totalSteps) * 100);
    progressFill.style.width = percent + '%';
    progressText.textContent = completed + ' de ' + totalSteps + ' respostas registradas';
  }

  function selectedReply(input, key) {
    if (offer === 'memorias') {
      if (key === 'origem') return content.memorias.subjects[input.value].reply;
      if (key === 'sinal') return content.memorias.signals[input.value].reply;
      return content.memorias.blocks[input.value].reply;
    }
    if (key === 'estagio') return content.mentoria.stages[input.value].reply;
    if (key === 'leitor') return content.mentoria.readers[input.value].reply;
    if (key === 'necessidade') return content.mentoria.obstacles[input.value].reply;
    return content.mentoria.finance[input.value].reply;
  }

  function resetAfter(index) {
    steps.slice(index + 1).forEach(function (step) {
      const key = step.dataset.hKey;
      delete answers[key];
      step.hidden = true;
      step.classList.remove('is-revealed');
      const checked = step.querySelector('input:checked');
      if (checked) checked.checked = false;
      const reply = step.querySelector('[data-h-reply]');
      if (reply) {
        reply.hidden = true;
        reply.textContent = '';
      }
    });
    result.hidden = true;
  }

  function revealStep(index) {
    const step = steps[index];
    if (!step) return;
    step.hidden = false;
    step.classList.remove('is-revealed');
    void step.offsetWidth;
    step.classList.add('is-revealed');
  }

  function fillMentorForm(view) {
    const form = document.getElementById('lead-form');
    if (!form || !view.finance) return;
    const mappings = {
      estagio: selectedValue('estagio'),
      leitor: selectedValue('leitor'),
      necessidade: selectedValue('necessidade'),
      investimento: view.finance.label,
      investimento_id: selectedValue('investimento'),
      qualificacao: view.finance.qualified ? 'qualificado' : 'nao_qualificado',
      elegivel_meta_lead: view.finance.qualified ? 'true' : 'false'
    };
    Object.keys(mappings).forEach(function (name) {
      const field = form.querySelector('[name="' + name + '"]');
      if (field) {
        field.value = mappings[name];
        if (name === 'investimento') field.dataset.qualified = view.finance.qualified ? 'true' : 'false';
      }
    });
    const diagnosis = form.querySelector('[name="diagnostico_personalizado"]');
    if (diagnosis) diagnosis.value = view.text;
  }

  function renderResult() {
    const view = currentView();
    result.hidden = false;

    if (offer === 'memorias') {
      result.querySelector('[data-h-result-title]').textContent = 'A sua primeira página pode começar por ' + view.subject.focus + '.';
      result.querySelector('[data-h-result-summary]').textContent = 'Você reconhece ' + view.signal.label + ' quando essa lembrança aparece, e o ponto que pede ajuda é ' + view.block.label + '. A prática abaixo respeita essas duas escolhas.';
      result.querySelector('[data-h-result-focus]').textContent = view.subject.focus;
      result.querySelector('[data-h-result-practice]').textContent = view.signal.practice;
      result.querySelector('[data-h-result-next]').textContent = view.block.next;
      result.querySelector('[data-h-result-route]').textContent = view.block.route;
    } else {
      const qualified = view.finance.qualified;
      body.dataset.qualification = qualified ? 'qualified' : 'not-qualified';
      result.querySelector('[data-h-result-title]').textContent = qualified ? 'O contexto do seu livro está pronto para ser enviado.' : 'O seu diagnóstico já indica qual trabalho vem primeiro.';
      result.querySelector('[data-h-result-summary]').textContent = view.text;
      result.querySelector('[data-h-result-stage]').textContent = view.stage.label;
      result.querySelector('[data-h-result-reader]').textContent = view.reader.direction;
      result.querySelector('[data-h-result-next]').textContent = view.obstacle.work;
      result.querySelector('[data-h-qualified]').hidden = !qualified;
      result.querySelector('[data-h-unqualified]').hidden = qualified;
      fillMentorForm(view);
      emit('qualification_select', {
        qualified: qualified,
        step: 'investment',
        stage: selectedValue('estagio'),
        intent: selectedValue('investimento')
      });
    }

    updateProgress();
    const completionPayload = {
      step: totalSteps,
      next_step: 'result',
      intent: steps.map(function (step) { return answers[step.dataset.hKey]; }).join('|')
    };
    const personalizationPayload = {
      step: totalSteps,
      next_step: 'result'
    };
    if (offer === 'mentoria') {
      completionPayload.qualified = view.finance.qualified;
      personalizationPayload.qualified = view.finance.qualified;
    }
    emit('quiz_complete', completionPayload);
    emit('personalization_complete', personalizationPayload);
    liveStatus.textContent = offer === 'memorias'
      ? 'A síntese da sua lembrança está disponível depois da última pergunta.'
      : 'A síntese do seu livro está disponível depois da última pergunta.';
  }

  function startExperience() {
    if (started) {
      const pendingStep = steps.find(function (step) { return !answers[step.dataset.hKey]; });
      const target = pendingStep || result;
      scrollToElement(target);
      focusHeading(target);
      return;
    }
    started = true;
    quiz.hidden = false;
    progress.hidden = false;
    emit('quiz_start', { step: 0, next_step: 1, trigger: 'start_button' });
    emit('personalization_start', { step: 0, next_step: 1, trigger: 'start_button' });
    revealStep(0);
    scrollToElement(steps[0]);
    focusHeading(steps[0]);
  }

  root.querySelectorAll('[data-h-start]').forEach(function (button) {
    button.addEventListener('click', startExperience);
  });

  steps.forEach(function (step, index) {
    step.addEventListener('change', function (event) {
      const input = event.target.closest('input[type="radio"]');
      if (!input) return;
      const key = step.dataset.hKey;
      const previous = answers[key];
      if (previous && previous !== input.value) resetAfter(index);
      answers[key] = input.value;

      const reply = step.querySelector('[data-h-reply]');
      if (reply) {
        reply.textContent = selectedReply(input, key);
        reply.hidden = false;
      }

      updateProgress();
      renderPersonalization();
      const stepPayload = {
        step: index + 1,
        next_step: index + 1 < totalSteps ? index + 2 : 'result',
        intent: key + ':' + input.value,
        trigger: 'answer'
      };
      if (input.hasAttribute('data-qualified')) stepPayload.qualified = input.dataset.qualified === 'true';
      emit('quiz_step', stepPayload);

      if (index + 1 < totalSteps) revealStep(index + 1);
      else renderResult();
    });
  });

  root.querySelectorAll('[data-h-restart]').forEach(function (button) {
    button.addEventListener('click', function () {
      Object.keys(answers).forEach(function (key) { delete answers[key]; });
      steps.forEach(function (step, index) {
        step.hidden = index !== 0;
        step.classList.toggle('is-revealed', index === 0);
        const checked = step.querySelector('input:checked');
        if (checked) checked.checked = false;
        const reply = step.querySelector('[data-h-reply]');
        if (reply) {
          reply.hidden = true;
          reply.textContent = '';
        }
      });
      result.hidden = true;
      body.removeAttribute('data-qualification');
      updateProgress();
      const defaults = content[offer].defaults;
      updateLiveCopy(defaults.kicker, defaults.title, defaults.text, 0);
      emit('quiz_restart', { step: 0, next_step: 1, trigger: 'restart' });
      emit('personalization_start', { step: 0, next_step: 1, trigger: 'restart' });
      scrollToElement(steps[0]);
      focusHeading(steps[0]);
    });
  });

})();
